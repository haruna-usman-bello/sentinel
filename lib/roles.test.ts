import { describe, expect, it } from "vitest";

import { ACCOUNTS } from "@/lib/data";
import {
  accountByEmail,
  ROLES,
  scopeLabelOf,
  scopeOf,
  userFromAccount,
} from "@/lib/roles";

describe("scopeOf", () => {
  it("derives scope from tier and posting", () => {
    expect(scopeOf({ role: "national" })).toEqual({});
    expect(scopeOf({ role: "state", state: "Kaduna" })).toEqual({ state: "Kaduna" });
    expect(scopeOf({ role: "officer", state: "Kaduna", lga: "Zaria" })).toEqual({
      state: "Kaduna",
      lga: "Zaria",
    });
    expect(scopeOf({ role: "sysadmin" })).toEqual({ none: true });
  });
});

describe("scopeLabelOf", () => {
  it("counts a state's LGAs from the facility register", () => {
    expect(scopeLabelOf({ role: "state", state: "Kaduna" })).toBe("Kaduna State · 4 LGAs");
  });
  it("names the LGA for field roles", () => {
    expect(scopeLabelOf({ role: "supervisor", state: "Kaduna", lga: "Giwa" })).toBe(
      "Giwa LGA · Kaduna",
    );
  });
});

describe("userFromAccount", () => {
  it("turns the register's em-dash placeholders into absent fields", () => {
    const national = userFromAccount(accountByEmail("national@ncdc.example.org")!);
    expect(national.state).toBeUndefined();
    expect(national.lga).toBeUndefined();
    expect(national.phone).toBe("+2348000000001");

    const officer = userFromAccount(accountByEmail("officer.sabongari@example.org")!);
    expect(officer.phone).toBeUndefined();
    expect(officer.lga).toBe("Sabon Gari");
  });
});

describe("accountByEmail", () => {
  it("is case-insensitive and trims", () => {
    expect(accountByEmail("  Officer.Zaria@Example.org ")?.name).toBe("Zaria LGA Officer");
    expect(accountByEmail("nobody@example.org")).toBeUndefined();
  });
});

describe("ROLES.can", () => {
  it("lets an officer open an investigation and nothing else", () => {
    expect(ROLES.officer.can.pending).toEqual(["investigating"]);
    expect(ROLES.officer.can.investigating).toEqual([]);
    expect(ROLES.officer.can.confirmed).toEqual([]);
  });

  it("never lets anyone reopen a closed flag", () => {
    for (const role of Object.values(ROLES)) {
      expect(role.can.closed).toEqual([]);
    }
  });

  it("gives the administrator no case powers", () => {
    expect(Object.values(ROLES.sysadmin.can).flat()).toEqual([]);
  });

  it("only offers navigation a role can act on", () => {
    expect(ROLES.sysadmin.nav.map((n) => n.href)).not.toContain("/flags");
    expect(ROLES.officer.nav.map((n) => n.href)).not.toContain("/thresholds");
    expect(ROLES.national.nav.map((n) => n.href)).toContain("/thresholds");
  });
});

describe("account register", () => {
  it("has a unique email for every account", () => {
    const emails = ACCOUNTS.map((a) => a.email.toLowerCase());
    expect(new Set(emails).size).toBe(emails.length);
  });
});
