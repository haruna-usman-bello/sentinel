import type { Denial } from "@/lib/types";

/**
 * What every mutation hands back to the screen that called it. Actions never
 * throw for an expected refusal — a denial is a result the screen explains,
 * not an error boundary.
 */
export type ActionResult =
  | { ok: true; message: string; description?: string }
  | { ok: false; error: string; denial?: Denial; fieldErrors?: Record<string, string> };

export const SESSION_EXPIRED: ActionResult = {
  ok: false,
  error: "Your session has expired. Sign in again to continue.",
};
