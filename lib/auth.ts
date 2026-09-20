import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

/** Surfaced to the sign-in form so it can say why, rather than "wrong password". */
export const DEACTIVATED_CODE = "ACCOUNT_DEACTIVATED";

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
  databaseHooks: {
    session: {
      create: {
        // A deactivated account keeps its password but can never open a session.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });
          if (!user?.active) {
            throw new APIError("FORBIDDEN", { message: DEACTIVATED_CODE });
          }
        },
        after: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { name: true, stateName: true },
          });
          if (!user) return;
          await prisma.activityLog.create({
            data: {
              actorId: session.userId,
              actorName: user.name,
              stateName: user.stateName,
              kind: "auth",
              action: "Signed in",
              detail: session.ipAddress
                ? `Session opened from ${session.ipAddress}`
                : "Session opened",
            },
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
