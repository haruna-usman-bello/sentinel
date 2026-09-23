import "server-only";

import { emailConfig, smsConfig } from "./config";

/**
 * The two ways an alert reaches a person. Each provider is one function, so
 * swapping Twilio or Resend for a local aggregator means editing this file
 * and nothing else.
 */

export interface Delivery {
  /** The provider's own reference, for tracing a message that went astray. */
  reference: string;
}

export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

export interface AlertTransport {
  sendSms(to: string, body: string): Promise<Delivery>;
  sendEmail(to: string, subject: string, body: string): Promise<Delivery>;
  /** Which channels this transport can actually deliver on. */
  readonly channels: { sms: boolean; email: boolean };
}

const TIMEOUT_MS = 15_000;

/**
 * A 4xx from a provider means the message itself is wrong — a malformed
 * number, an unverified sender — and retrying will not help. A 5xx or a
 * network failure is worth another attempt.
 */
function classify(status: number, body: string): DeliveryError {
  const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
  return new DeliveryError(`HTTP ${status}: ${body.slice(0, 200)}`, permanent);
}

export function liveTransport(): AlertTransport {
  const sms = smsConfig();
  const email = emailConfig();

  return {
    channels: { sms: Boolean(sms), email: Boolean(email) },

    async sendSms(to, body) {
      if (!sms) throw new DeliveryError("SMS is not configured.", true);
      const form = new URLSearchParams({ To: to, From: sms.from, Body: body });
      const response = await fetch(
        `${sms.baseUrl}/2010-04-01/Accounts/${sms.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      const text = await response.text();
      if (!response.ok) throw classify(response.status, text);
      const parsed = JSON.parse(text) as { sid?: string };
      return { reference: parsed.sid ?? "sent" };
    },

    async sendEmail(to, subject, body) {
      if (!email) throw new DeliveryError("Email is not configured.", true);
      const response = await fetch(`${email.baseUrl}/emails`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${email.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from: email.from, to: [to], subject, text: body }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      if (!response.ok) throw classify(response.status, text);
      const parsed = JSON.parse(text) as { id?: string };
      return { reference: parsed.id ?? "sent" };
    },
  };
}

/** Records what it was asked to send, for tests and dry runs. */
export function recordingTransport(
  channels: { sms: boolean; email: boolean } = { sms: true, email: true },
  fail?: (to: string) => DeliveryError | null,
): AlertTransport & { sent: { channel: "sms" | "email"; to: string; body: string }[] } {
  const sent: { channel: "sms" | "email"; to: string; body: string }[] = [];
  let n = 0;
  return {
    sent,
    channels,
    async sendSms(to, body) {
      const problem = fail?.(to);
      if (problem) throw problem;
      sent.push({ channel: "sms", to, body });
      return { reference: `sms-${++n}` };
    },
    async sendEmail(to, subject, body) {
      const problem = fail?.(to);
      if (problem) throw problem;
      sent.push({ channel: "email", to, body: `${subject}\n${body}` });
      return { reference: `email-${++n}` };
    },
  };
}
