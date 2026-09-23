import { describe, expect, it } from "vitest";

import { routeFor, smsBody, subjectFor } from "@/lib/alerts/routing";

const both = { sms: true, email: true };
const supervisor = { phone: "+2348000000014", email: "supervisor.zaria@example.org" };

describe("routeFor", () => {
  it("uses the channel the alert was raised on", () => {
    expect(routeFor("sms", supervisor, both)).toEqual({
      deliverable: true,
      channel: "sms",
      address: "+2348000000014",
    });
    expect(routeFor("email", supervisor, both)).toMatchObject({
      channel: "email",
      address: "supervisor.zaria@example.org",
    });
  });

  it("falls back rather than dropping the alert", () => {
    // Hearing late by email beats not hearing at all.
    expect(routeFor("sms", supervisor, { sms: false, email: true })).toMatchObject({
      channel: "email",
    });
    expect(routeFor("email", supervisor, { sms: true, email: false })).toMatchObject({
      channel: "sms",
    });
  });

  it("does not fall back to a channel the person has no address for", () => {
    const noPhone = { phone: null, email: "officer@example.org" };
    const route = routeFor("email", noPhone, { sms: true, email: false });
    expect(route.deliverable).toBe(false);
    if (!route.deliverable) {
      expect(route.permanent).toBe(true);
      // Says which of the two was missing on each channel, rather than guessing.
      expect(route.reason).toBe(
        "Nowhere to send it: no phone number on file, and Email is not configured.",
      );
    }
  });

  it("names the missing address when the channel itself is configured", () => {
    const route = routeFor("sms", { phone: null, email: null }, both);
    expect(route.deliverable).toBe(false);
    if (!route.deliverable) {
      expect(route.reason).toBe(
        "Nowhere to send it: no phone number on file, and no email address on file.",
      );
    }
  });

  it("treats no configured channel as a deployment state, not a failure", () => {
    const route = routeFor("sms", supervisor, { sms: false, email: false });
    expect(route.deliverable).toBe(false);
    if (!route.deliverable) {
      // Not permanent: configuring a provider later should let it go out.
      expect(route.permanent).toBe(false);
      expect(route.reason).toMatch(/No alert channel is configured/);
    }
  });

  it("ignores an address that is only whitespace", () => {
    const route = routeFor("sms", { phone: "   ", email: "a@b.org" }, both);
    expect(route).toMatchObject({ channel: "email", address: "a@b.org" });
  });

  it("has nowhere to send an alert to a recipient with no addresses", () => {
    const route = routeFor("sms", { phone: null, email: null }, both);
    expect(route.deliverable).toBe(false);
    if (!route.deliverable) expect(route.permanent).toBe(true);
  });
});

describe("subjectFor", () => {
  it("takes the first sentence, which is what names the signal", () => {
    expect(
      subjectFor(
        "Unusual rise — Zaria General Hospital (Zaria LGA), Cholera, Aug 2026. 41 cases reported.",
      ),
    ).toBe("Unusual rise — Zaria General Hospital (Zaria LGA), Cholera, Aug 2026");
  });

  it("trims a subject that would be cut off anyway", () => {
    const subject = subjectFor("x".repeat(400));
    expect(subject.length).toBeLessThanOrEqual(120);
    expect(subject.endsWith("…")).toBe(true);
  });

  it("never returns an empty subject", () => {
    expect(subjectFor("")).toBe("Surveillance alert");
  });
});

describe("smsBody", () => {
  it("leaves a normal alert alone", () => {
    const message = "No report — Kongo Clinic (Sabon Gari LGA), Measles, Aug 2026.";
    expect(smsBody(message)).toBe(message);
  });

  it("trims rather than splitting across segments", () => {
    const body = smsBody("y".repeat(500));
    expect(body.length).toBe(320);
    expect(body.endsWith("…")).toBe(true);
  });
});
