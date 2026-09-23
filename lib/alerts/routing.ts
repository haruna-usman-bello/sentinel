/**
 * Deciding how an alert should reach someone. No I/O, so the rules can be
 * read and tested on their own.
 */

export type Channel = "sms" | "email";

export interface Recipient {
  phone: string | null;
  email: string | null;
}

export interface Available {
  sms: boolean;
  email: boolean;
}

export type Route =
  | { deliverable: true; channel: Channel; address: string }
  | { deliverable: false; reason: string; permanent: boolean };

/**
 * Where an alert should go, given who it is for and which channels this
 * deployment can actually use.
 *
 * The preferred channel is whichever the alert was raised on — SMS where the
 * account has a number, email otherwise. If that channel is not configured,
 * the other is used rather than dropping the alert: a surveillance officer
 * would far rather hear late by email than not at all. Nothing is ever
 * reported as sent that was not.
 */
export function routeFor(
  preferred: Channel,
  recipient: Recipient,
  available: Available,
): Route {
  const address = (channel: Channel) =>
    (channel === "sms" ? recipient.phone : recipient.email)?.trim() || null;

  const order: Channel[] = preferred === "sms" ? ["sms", "email"] : ["email", "sms"];
  for (const channel of order) {
    const to = address(channel);
    if (available[channel] && to) return { deliverable: true, channel, address: to };
  }

  if (!available.sms && !available.email) {
    return {
      deliverable: false,
      permanent: false,
      reason: "No alert channel is configured, so nothing was sent.",
    };
  }

  // A channel is usable only if it is both configured and has an address to
  // aim at, so say which of the two was missing rather than guessing.
  const missing = (["sms", "email"] as Channel[]).map((channel) => {
    const what = channel === "sms" ? "phone number" : "email address";
    if (!available[channel]) return `${channel === "sms" ? "SMS" : "Email"} is not configured`;
    return `no ${what} on file`;
  });

  return {
    deliverable: false,
    permanent: true,
    reason: `Nowhere to send it: ${missing[0]}, and ${missing[1]}.`,
  };
}

/**
 * An alert reads as one line. The subject is the part before the first full
 * stop — "Unusual rise — Zaria General Hospital (Zaria LGA), Cholera, Aug
 * 2026" — which is what a person sees in a list of unread mail.
 */
export function subjectFor(message: string): string {
  const firstSentence = message.split(/\.\s/)[0]?.trim() ?? message;
  const subject = firstSentence.length > 120 ? `${firstSentence.slice(0, 117)}…` : firstSentence;
  return subject || "Surveillance alert";
}

/** SMS is billed per segment, so a long alert is trimmed rather than split. */
export function smsBody(message: string, limit = 320): string {
  return message.length <= limit ? message : `${message.slice(0, limit - 1)}…`;
}
