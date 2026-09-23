import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { MAX_DELIVERY_ATTEMPTS } from "./config";
import { routeFor, smsBody, subjectFor, type Available } from "./routing";
import { DeliveryError, liveTransport, type AlertTransport } from "./transport";

export interface DispatchSummary {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Delivers the alerts that have not gone out yet.
 *
 * Alerts are written when a flag is raised or decided, inside the same
 * transaction as the decision, and delivered afterwards — so a provider being
 * slow or down can never roll back an outbreak confirmation. Anything still
 * undelivered is retried on the next run, which is what makes the scheduled
 * cycle worth having even when nothing new arrives from DHIS2.
 */
export async function dispatchPending(options: {
  transport?: AlertTransport;
  limit?: number;
} = {}): Promise<DispatchSummary> {
  const transport = options.transport ?? liveTransport();
  const available: Available = transport.channels;

  const due = await prisma.notification.findMany({
    where: {
      // `skipped` is included deliberately: an alert that had nowhere to go
      // when it was raised should go out as soon as a provider is configured.
      // It costs no attempt, so it waits indefinitely rather than expiring.
      delivery: { in: ["pending", "failed", "skipped"] },
      attempts: { lt: MAX_DELIVERY_ATTEMPTS },
    },
    include: { recipient: { select: { phone: true, email: true } } },
    orderBy: { at: "asc" },
    take: options.limit ?? 100,
  });

  const summary: DispatchSummary = { attempted: 0, sent: 0, failed: 0, skipped: 0 };

  for (const alert of due) {
    summary.attempted++;
    const route = routeFor(alert.channel, alert.recipient ?? { phone: null, email: null }, available);

    if (!route.deliverable) {
      summary.skipped++;
      await prisma.notification.update({
        where: { id: alert.id },
        data: {
          // A missing channel is a deployment state, not a failure to retry.
          delivery: route.permanent ? "failed" : "skipped",
          deliveryDetail: route.reason,
          attempts: route.permanent ? { increment: 1 } : undefined,
        },
      });
      continue;
    }

    let update: Prisma.NotificationUpdateInput;
    try {
      const result =
        route.channel === "sms"
          ? await transport.sendSms(route.address, smsBody(alert.message))
          : await transport.sendEmail(route.address, subjectFor(alert.message), alert.message);
      summary.sent++;
      update = {
        channel: route.channel,
        recipientAddress: route.address,
        delivery: "sent",
        deliveredAt: new Date(),
        deliveryDetail: result.reference,
        attempts: { increment: 1 },
      };
    } catch (error) {
      summary.failed++;
      const permanent = error instanceof DeliveryError && error.permanent;
      const attempts = alert.attempts + 1;
      update = {
        channel: route.channel,
        recipientAddress: route.address,
        // Something worth retrying stays pending until the attempts run out.
        delivery: permanent || attempts >= MAX_DELIVERY_ATTEMPTS ? "failed" : "pending",
        deliveryDetail: (error as Error).message.slice(0, 500),
        attempts: { increment: 1 },
      };
    }

    await prisma.notification.update({ where: { id: alert.id }, data: update });
  }

  return summary;
}

/**
 * Delivers immediately after a decision, without letting a slow provider hold
 * up the person who made it. Anything that does not go out now is picked up
 * by the scheduled run.
 */
export async function dispatchSoon(): Promise<void> {
  try {
    await dispatchPending({ limit: 25 });
  } catch (error) {
    console.error("Alert dispatch failed; the alerts remain queued.", error);
  }
}
