import { z } from "zod";

import { FLAG_STATUSES } from "@/lib/types";

/** Nigerian mobile numbers as the alert dispatcher expects them, or blank for email. */
const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[0-9][0-9\s-]{7,17}$/.test(v), {
    message: "Enter a phone number like +2348000000000, or leave it blank for email alerts.",
  });

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the email address your account was registered with.")
    .pipe(z.email("That does not look like an email address.")),
  password: z.string().min(8, "Accounts require a password of at least 8 characters."),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * A dismissal without a reason cannot be reviewed later, so `false_alarm`
 * requires a note where the other transitions do not.
 */
export const flagTransitionSchema = z
  .object({
    flagId: z.coerce.number().int().positive(),
    to: z.enum(FLAG_STATUSES as [string, ...string[]]),
    note: z.string().trim().max(500, "Keep the note under 500 characters.").default(""),
  })
  .refine((v) => v.to !== "false_alarm" || v.note.length > 0, {
    path: ["note"],
    message: "Give a reason — a dismissal without one cannot be reviewed later.",
  });

export type FlagTransitionInput = z.infer<typeof flagTransitionSchema>;

export const createAccountSchema = z.object({
  name: z.string().trim().min(3, "Give the account a name, e.g. “Ikara LGA Officer”."),
  role: z.enum(["officer", "supervisor", "state", "national"]),
  state: z.string().trim().min(1, "Pick a state."),
  lga: z.string().trim().min(1, "Pick an LGA."),
  phone,
  email: z
    .string()
    .trim()
    .min(1, "An email address is required — it is the account's sign-in identity.")
    .pipe(z.email("That does not look like an email address.")),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  phone,
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * k is a multiple of a facility's usual variation, not a case count. Above
 * about 6 nothing would ever flag; at or below 0 everything would.
 */
export const alertLevelSchema = z.object({
  disease: z.string().trim().min(1, "Pick a disease."),
  k: z.coerce
    .number({ message: "Enter the alert level as a number, e.g. 2.0." })
    .gt(0, "The alert level must be greater than 0.")
    .lte(6, "An alert level above 6 would never flag anything. Enter a value up to 6."),
});

export type AlertLevelInput = z.infer<typeof alertLevelSchema>;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password first."),
    next: z.string().min(8, "The new password needs at least 8 characters."),
    repeat: z.string().min(1, "Repeat the new password."),
  })
  .refine((v) => v.next === v.repeat, {
    path: ["repeat"],
    message: "The two new passwords don't match.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Flattens a Zod error into the `{ field: message }` shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
