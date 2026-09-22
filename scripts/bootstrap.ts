/**
 * Prepares an empty database for real use: one administrator to sign in as,
 * and the diseases under surveillance. Unlike the seed it is additive and
 * safe to run against a live database — it creates what is missing and
 * changes nothing that already exists.
 *
 *   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run db:bootstrap
 *
 * The administrator can then create every other account from the user
 * management screen. Facilities are not created here: they are a register,
 * and belong to whatever system already holds them.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { generateId } from "better-auth";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Diseases to put under surveillance, if they are not there already. */
const DISEASES = (process.env.BOOTSTRAP_DISEASES ?? "Cholera,Measles")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    fail("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD, then run this again.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`${email} is not an email address.`);
  if (password.length < 8) fail("The password needs at least 8 characters.");

  for (const disease of DISEASES) {
    const existing = await prisma.disease.findUnique({ where: { name: disease } });
    if (existing) {
      console.log(`· ${disease} is already under surveillance, at ${existing.alertLevelK.toFixed(2)}×.`);
      continue;
    }
    await prisma.disease.create({ data: { name: disease } });
    console.log(`✓ ${disease} put under surveillance at the default alert level.`);
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) {
    console.log(`· ${email} already has an account (${taken.role}); leaving it untouched.`);
  } else {
    const id = generateId();
    // Better Auth recognises a credential account by accountId === user id.
    await prisma.user.create({
      data: {
        id,
        name,
        email,
        emailVerified: true,
        role: "sysadmin",
        accounts: {
          create: {
            providerId: "credential",
            accountId: id,
            password: await hashPassword(password),
          },
        },
      },
    });
    await prisma.activityLog.create({
      data: {
        actorId: id,
        actorName: name,
        kind: "account",
        action: "Account created",
        detail: `${name} (${email}) — first administrator, created at bootstrap`,
      },
    });
    console.log(`✓ Administrator ${name} <${email}> created.`);
  }

  const facilities = await prisma.facility.count();
  console.log(
    facilities
      ? `\n${facilities} facilities are on the register. Map them to DHIS2 organisation units on the ingestion screen.`
      : "\nNo facilities are on the register yet, so there is nothing to collect from. Load the facility register before the first pull.",
  );
  console.log("Sign in as the administrator to create the surveillance accounts.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
