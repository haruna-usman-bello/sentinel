import { describe, expect, it } from "vitest";

import {
  alertLevelSchema,
  changePasswordSchema,
  createAccountSchema,
  fieldErrors,
  flagTransitionSchema,
  signInSchema,
} from "@/lib/validation";

describe("signInSchema", () => {
  it("requires a well-formed email and an 8+ character password", () => {
    const bad = signInSchema.safeParse({ email: "not-an-email", password: "short" });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const errors = fieldErrors(bad.error);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
    }
  });

  it("trims the email", () => {
    const ok = signInSchema.safeParse({ email: "  a@b.org ", password: "password1" });
    expect(ok.success && ok.data.email).toBe("a@b.org");
  });
});

describe("flagTransitionSchema", () => {
  it("requires a reason to dismiss as a false alarm", () => {
    const bad = flagTransitionSchema.safeParse({ flagId: 1, to: "false_alarm", note: "  " });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrors(bad.error).note).toMatch(/reason/i);
  });

  it("lets a confirmation go through without a note", () => {
    const ok = flagTransitionSchema.safeParse({ flagId: "3", to: "confirmed" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.flagId).toBe(3);
      expect(ok.data.note).toBe("");
    }
  });

  it("rejects an unknown status", () => {
    expect(flagTransitionSchema.safeParse({ flagId: 1, to: "archived" }).success).toBe(false);
  });
});

describe("alertLevelSchema", () => {
  it("coerces a typed number and bounds it to (0, 6]", () => {
    expect(alertLevelSchema.safeParse({ disease: "Cholera", k: "2.5" }).success).toBe(true);
    expect(alertLevelSchema.safeParse({ disease: "Cholera", k: "0" }).success).toBe(false);
    expect(alertLevelSchema.safeParse({ disease: "Cholera", k: "6.1" }).success).toBe(false);
    expect(alertLevelSchema.safeParse({ disease: "Cholera", k: "abc" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("insists the two new passwords match", () => {
    const bad = changePasswordSchema.safeParse({
      current: "oldpassword",
      next: "newpassword",
      repeat: "newpassw0rd",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(fieldErrors(bad.error).repeat).toMatch(/match/);
  });
});

describe("createAccountSchema", () => {
  const valid = {
    name: "Ikara LGA Officer",
    role: "officer",
    state: "Kaduna",
    lga: "Ikara",
    phone: "+2348000000099",
    email: "officer.ikara@example.org",
  };

  it("accepts a complete account", () => {
    expect(createAccountSchema.safeParse(valid).success).toBe(true);
  });

  it("allows a blank phone, meaning email alerts", () => {
    expect(createAccountSchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
  });

  it("rejects a malformed phone", () => {
    expect(createAccountSchema.safeParse({ ...valid, phone: "call me" }).success).toBe(false);
  });

  it("does not let the sysadmin tier be created from the form", () => {
    expect(createAccountSchema.safeParse({ ...valid, role: "sysadmin" }).success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("keeps the first message per field", () => {
    const bad = signInSchema.safeParse({ email: "", password: "" });
    if (bad.success) throw new Error("expected failure");
    const errors = fieldErrors(bad.error);
    expect(Object.keys(errors).sort()).toEqual(["email", "password"]);
  });
});
