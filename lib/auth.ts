import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

/** Surfaced to the sign-in form so it can say why, rather than "wrong password". */
export const DEACTIVATED_CODE = "ACCOUNT_DEACTIVATED";

/**
 * Where this deployment lives. Better Auth signs cookies and checks request
 * origins against it, so it has to be the address people actually reach.
 *
 * Set BETTER_AUTH_URL to that address. On Vercel this is not optional in
 * practice: VERCEL_PROJECT_PRODUCTION_URL is not always exposed at runtime,
 * and without it the only trusted origin is the deployment's own generated
 * hostname — so the stable alias people actually visit refuses every sign-in
 * as cross-origin. It is worth stating once rather than debugging twice.
 */
function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  return undefined;
}

/**
 * Origins allowed to post to the auth endpoints. Only this deployment's own
 * addresses — never a wildcard over the platform's domain, which would trust
 * every other application hosted on it.
 */
function trustedOrigins(): string[] {
  const origins = new Set<string>();
  const base = baseURL();
  if (base) origins.add(base);
  // The hostname of the deployment currently serving the request.
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);
  return [...origins];
}

/**
 * Accounts are provisioned by an administrator, never self-registered — a
 * surveillance system has no public sign-up. Sessions match the 30-minute
 * idle expiry advertised on the sign-in screen.
 */
export const auth = betterAuth({
  baseURL: baseURL(),
  trustedOrigins: trustedOrigins(),
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
