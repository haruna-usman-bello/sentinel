"use server";

import { APIError } from "better-auth/api";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { formatStamp } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { accountScope } from "@/lib/queries/accounts";
import { viewer } from "@/lib/queries/shared";
import { currentSession } from "@/lib/session";
import type { Role } from "@/lib/types";
import {
  changePasswordSchema,
  createAccountSchema,
  fieldErrors,
  updateAccountSchema,
} from "@/lib/validation";

import { SESSION_EXPIRED, type ActionResult } from "./shared";

/** One-time credential handed to the administrator to pass on; it is never stored in clear. */
const temporaryPassword = () =>
  generateRandomString(12, "a-z", "A-Z", "0-9");

/**
 * Account administration. The administrator manages every account; a state
 * coordinator manages the officers and supervisors posted in their state.
 * Every change is written to the activity log under the actor's name.
 */

async function administered(id: string) {
  const { scope, role } = await viewer();
  const where = accountScope(scope, role.key);
  if (!where) return null;
  return prisma.user.findFirst({
    where: { ...where, id },
    select: { id: true, name: true, email: true, role: true, stateName: true, lgaName: true, phone: true, active: true, deactivationNote: true },
  });
}

function log(actorId: string, actorName: string, stateName: string | null, action: string, detail: string) {
  return prisma.activityLog.create({
    data: { actorId, actorName, stateName, kind: "account", action, detail },
  });
}

export async function createAccountAction(input: unknown): Promise<ActionResult & { temporaryPassword?: string }> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, role, scope } = await viewer();

  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;
  const newRole = data.role as Role;

  // A state coordinator provisions only LGA roles, only within their own state.
  if (role.key === "state") {
    if (newRole !== "officer" && newRole !== "supervisor") {
      return { ok: false, error: "A state coordinator can create officer and supervisor accounts only." };
    }
    if (data.state !== scope.state) {
      return { ok: false, error: `You can only create accounts posted in ${scope.state} State.` };
    }
  } else if (role.key !== "sysadmin") {
    return { ok: false, error: "Your role does not manage accounts." };
  }

  const stateName = newRole === "national" ? null : data.state;
  const lgaName = newRole === "officer" || newRole === "supervisor" ? data.lga : null;

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          emailVerified: true,
          role: newRole,
          stateName,
          lgaName,
          phone: data.phone || null,
          accounts: { create: { providerId: "credential", accountId: "", password: passwordHash } },
        },
      });
      // Better Auth recognises a credential account by accountId === user id.
      await tx.account.updateMany({ where: { userId: account.id }, data: { accountId: account.id } });
      await tx.activityLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          stateName: stateName ?? scope.state ?? null,
          kind: "account",
          action: "Account created",
          detail: `${account.name} (${account.email})`,
        },
      });
      return account;
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Account created for ${created.name}.`,
      description: "Share the temporary password securely; they should change it at first sign-in.",
      temporaryPassword: password,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "Check the form.",
        fieldErrors: { email: "An account with that email address already exists." },
      };
    }
    throw error;
  }
}

export async function updateAccountPhoneAction(input: unknown): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, scope } = await viewer();

  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }
  const target = await administered(parsed.data.accountId);
  if (!target) return { ok: false, error: "That account is not yours to manage." };

  const phone = parsed.data.phone;
  if (phone === (target.phone ?? "")) return { ok: true, message: "No changes to save." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { phone: phone || null } }),
    log(user.id, user.name, scope.state ?? null, "Account updated", `${target.name} — alert channel now ${phone ? "SMS" : "email"}`),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, message: `${target.name} will now be alerted by ${phone ? "SMS" : "email"}.` };
}

/**
 * Deactivation keeps the account and its history; it only stops sign-in,
 * and ends any session the account has open right now.
 */
export async function toggleAccountAction(accountId: string): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, scope } = await viewer();

  const target = await administered(accountId);
  if (!target) return { ok: false, error: "That account is not yours to manage." };
  if (target.id === user.id) return { ok: false, error: "You cannot deactivate your own account." };

  const active = !target.active;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        active,
        deactivationNote: active ? null : `Deactivated ${formatStamp().slice(0, 10)} by ${user.name}`,
      },
    }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { userId: target.id } })]),
    log(user.id, user.name, scope.state ?? null, active ? "Account reactivated" : "Account deactivated", target.name),
  ]);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: active
      ? `${target.name} can sign in again.`
      : `${target.name} can no longer sign in. Their history stays in the audit trail.`,
  };
}

/** Replaces the password with a temporary one and signs the account out everywhere. */
export async function resetAccountPasswordAction(
  accountId: string,
): Promise<ActionResult & { temporaryPassword?: string }> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, scope } = await viewer();

  const target = await administered(accountId);
  if (!target) return { ok: false, error: "That account is not yours to manage." };

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId: target.id, providerId: "credential" } }),
    prisma.account.create({
      data: { userId: target.id, providerId: "credential", accountId: target.id, password: passwordHash },
    }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
    log(user.id, user.name, scope.state ?? null, "Password reset issued", `${target.name} — temporary password issued by ${user.name}`),
  ]);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Password reset for ${target.name}.`,
    description: "Every session on that account has been signed out.",
    temporaryPassword: password,
  };
}

/** The signed-in person changing their own password; every other session is signed out. */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  if (!(await currentSession())) return SESSION_EXPIRED;
  const { user, scope } = await viewer();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form.", fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.current,
        newPassword: parsed.data.next,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        ok: false,
        error: "Check the form.",
        fieldErrors: { current: "That is not your current password." },
      };
    }
    throw error;
  }

  await prisma.activityLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      stateName: scope.state ?? null,
      kind: "auth",
      action: "Password changed",
      detail: "All other sessions on this account were signed out",
    },
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Password updated.",
    description: "Every other session on your account has been signed out.",
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
