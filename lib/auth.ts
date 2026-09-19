import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

/**
 * Accounts are provisioned by an administrator, never self-registered — a
 * surveillance system has no public sign-up. Sessions match the 30-minute
 * idle expiry advertised on the sign-in screen.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 30,
    updateAge: 60 * 5,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: false },
      stateName: { type: "string", required: false, input: false },
      lgaName: { type: "string", required: false, input: false },
      phone: { type: "string", required: false, input: false },
      active: { type: "boolean", required: false, defaultValue: true, input: false },
      deactivationNote: { type: "string", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
