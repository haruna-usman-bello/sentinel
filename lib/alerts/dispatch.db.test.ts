import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_DELIVERY_ATTEMPTS } from "@/lib/alerts/config";
import { dispatchPending } from "@/lib/alerts/dispatch";
import { DeliveryError, recordingTransport } from "@/lib/alerts/transport";
import { prisma } from "@/lib/prisma";

/**
 * Delivering alerts against the seeded database. The seed leaves every
 * notification undelivered, which is the state a real deployment starts in.
 */

/**
 * Back to the state the seed leaves: undelivered, and addressed to the
 * channel the recipient is reachable on — SMS where they have a number.
 * Delivery rewrites `channel` to whatever it actually used, so restoring it
 * matters between tests.
 */
async function reset() {
  await prisma.notification.updateMany({
    data: {
      delivery: "pending",
      attempts: 0,
      deliveredAt: null,
      deliveryDetail: null,
      recipientAddress: null,
    },
  });
  const alerts = await prisma.notification.findMany({
    select: { id: true, recipient: { select: { phone: true } } },
  });
  for (const alert of alerts) {
    await prisma.notification.update({
      where: { id: alert.id },
      data: { channel: alert.recipient?.phone ? "sms" : "email" },
    });
  }
}

async function byRecipient(name: string) {
  return prisma.notification.findFirst({
    where: { recipientName: name },
    orderBy: { at: "desc" },
  });
}

describe("dispatching alerts", () => {
  beforeEach(reset);
  afterAll(async () => {
    await reset();
    await prisma.$disconnect();
  });

  it("sends each alert on the channel its recipient is reachable on", async () => {
    const transport = recordingTransport();
    const summary = await dispatchPending({ transport });

    expect(summary.attempted).toBeGreaterThan(0);
    expect(summary.sent).toBe(summary.attempted);
    expect(summary.failed).toBe(0);

    // The Kaduna coordinator has a number on file, so SMS.
    const kaduna = await byRecipient("Kaduna State Coordinator");
    expect(kaduna).toMatchObject({ delivery: "sent", channel: "sms" });
    expect(kaduna?.recipientAddress).toMatch(/^\+234/);
    expect(kaduna?.deliveredAt).not.toBeNull();
    expect(kaduna?.deliveryDetail).toMatch(/^sms-/);

    // Every address it was asked to send to belongs to somebody.
    expect(transport.sent.length).toBe(summary.sent);
    expect(transport.sent.every((m) => m.to.length > 3)).toBe(true);
  });

  it("does not send the same alert twice", async () => {
    const first = recordingTransport();
    await dispatchPending({ transport: first });
    const second = recordingTransport();
    const summary = await dispatchPending({ transport: second });

    expect(summary.attempted).toBe(0);
    expect(second.sent).toEqual([]);
  });

  it("falls back to email when SMS is not configured, rather than dropping it", async () => {
    const transport = recordingTransport({ sms: false, email: true });
    await dispatchPending({ transport });

    const kaduna = await byRecipient("Kaduna State Coordinator");
    expect(kaduna).toMatchObject({ delivery: "sent", channel: "email" });
    expect(kaduna?.recipientAddress).toContain("@");
  });

  it("records alerts as skipped, not failed, when nothing is configured", async () => {
    const transport = recordingTransport({ sms: false, email: false });
    const summary = await dispatchPending({ transport });

    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(summary.attempted);

    const kaduna = await byRecipient("Kaduna State Coordinator");
    expect(kaduna).toMatchObject({ delivery: "skipped", attempts: 0 });
    expect(kaduna?.deliveryDetail).toMatch(/No alert channel is configured/);

    // Skipped is not a dead end: configuring a provider lets them go out.
    const sending = recordingTransport();
    const after = await dispatchPending({ transport: sending });
    expect(after.sent).toBeGreaterThan(0);
  });

  it("keeps retrying a temporary failure until the attempts run out", async () => {
    const failing = recordingTransport({ sms: true, email: true }, () =>
      new DeliveryError("HTTP 503: upstream unavailable", false),
    );

    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      const summary = await dispatchPending({ transport: failing });
      const kaduna = await byRecipient("Kaduna State Coordinator");
      expect(kaduna?.attempts).toBe(attempt);
      if (attempt < MAX_DELIVERY_ATTEMPTS) {
        expect(kaduna?.delivery).toBe("pending");
        expect(summary.attempted).toBeGreaterThan(0);
      } else {
        expect(kaduna?.delivery).toBe("failed");
      }
    }

    // Having run out of attempts, it is left alone rather than retried for ever.
    const summary = await dispatchPending({ transport: failing });
    expect(summary.attempted).toBe(0);
  });

  it("gives up at once on a failure that retrying cannot fix", async () => {
    const rejecting = recordingTransport({ sms: true, email: true }, () =>
      new DeliveryError("HTTP 400: 'To' number is not a valid phone number", true),
    );
    await dispatchPending({ transport: rejecting });

    const kaduna = await byRecipient("Kaduna State Coordinator");
    expect(kaduna).toMatchObject({ delivery: "failed", attempts: 1 });
    expect(kaduna?.deliveryDetail).toMatch(/not a valid phone number/);
  });

  it("marks an alert with nobody to send it to as failed, and says so", async () => {
    const orphan = await prisma.notification.create({
      data: {
        channel: "sms",
        recipientName: "Former Borno State Coordinator",
        message: "Status update — a facility in a state with no coordinator.",
      },
    });
    await dispatchPending({ transport: recordingTransport() });

    const after = await prisma.notification.findUniqueOrThrow({ where: { id: orphan.id } });
    expect(after.delivery).toBe("failed");
    expect(after.deliveryDetail).toMatch(/Nowhere to send it/);

    await prisma.notification.delete({ where: { id: orphan.id } });
  });
});
