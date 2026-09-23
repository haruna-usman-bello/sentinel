import "server-only";

/**
 * How an alert leaves the building. Both channels are optional and
 * independent: a deployment may have SMS and no email, or neither. Where a
 * channel is not configured its alerts are recorded and marked `skipped`,
 * never silently dropped and never pretended to have been sent.
 */

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  from: string;
  /** Override for an aggregator that speaks the same API from another host. */
  baseUrl: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
  baseUrl: string;
}

export function smsConfig(): SmsConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const baseUrl = (process.env.TWILIO_API_BASE ?? "https://api.twilio.com").replace(/\/+$/, "");
  return accountSid && authToken && from ? { accountSid, authToken, from, baseUrl } : null;
}

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  const baseUrl = (process.env.RESEND_API_BASE ?? "https://api.resend.com").replace(/\/+$/, "");
  return apiKey && from ? { apiKey, from, baseUrl } : null;
}

/** How many times a failed alert is retried before it is left alone. */
export const MAX_DELIVERY_ATTEMPTS = 4;
