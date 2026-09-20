"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import { ACCOUNTS, ACTIVITY, NOTIFICATIONS, THRESHOLDS } from "@/lib/data";
import { formatStamp, scopedNotifications } from "@/lib/domain";
import { ROLES, scopeLabelOf, scopeOf } from "@/lib/roles";
import type {
  AccountRecord,
  ActivityEntry,
  ActivityKind,
  Denial,
  DiseaseThreshold,
  Notification,
  Role,
  RoleDefinition,
  Scope,
  SessionUser,
} from "@/lib/types";
import type { CreateAccountInput } from "@/lib/validation";

interface DashboardValue {
  user: SessionUser;
  role: RoleDefinition;
  scope: Scope;
  scopeLabel: string;
  /** The reporting month in view, carried in the URL so the server reads the same one. */
  period: string;
  periods: string[];
  currentPeriod: string;
  setPeriod: (period: string) => void;
  /** Flags still open in scope as of the current month. */
  openCount: number;
  notifications: Notification[];
  activity: ActivityEntry[];
  accounts: AccountRecord[];
  thresholds: DiseaseThreshold[];
  /** A refusal raised by the current screen; navigating away retires it. */
  denial: Denial | null;
  raiseDenial: (denial: Denial) => void;
  clearDenial: () => void;
  unreadCount: number;
  markNotification: (id: number) => void;
  markAllRead: () => void;
  updateAccountPhone: (id: number, phone: string) => boolean;
  toggleAccount: (id: number) => void;
  resetAccountPassword: (id: number) => void;
  createAccount: (input: CreateAccountInput) => void;
  setAlertLevel: (disease: string, k: number) => void;
  recordPasswordChange: () => void;
  logActivity: (kind: ActivityKind, action: string, detail: string) => void;
}

const DashboardContext = createContext<DashboardValue | null>(null);

export function useDashboard(): DashboardValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}

export function DashboardProvider({
  user,
  periods,
  currentPeriod,
  openCount,
  children,
}: {
  user: SessionUser;
  periods: string[];
  currentPeriod: string;
  openCount: number;
  children: React.ReactNode;
}) {
  const role = ROLES[user.role];
  const scope = useMemo(() => scopeOf(user), [user]);
  const scopeLabel = useMemo(() => scopeLabelOf(user), [user]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get("period");
  const period = requested && periods.includes(requested) ? requested : currentPeriod;

  const setPeriod = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next === currentPeriod) params.delete("period");
      else params.set("period", next);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, currentPeriod, router, pathname],
  );

  const [notifications, setNotifications] = useState<Notification[]>(() =>
    NOTIFICATIONS.map((n) => ({ ...n })),
  );
  const [activity, setActivity] = useState<ActivityEntry[]>(() => [...ACTIVITY]);
  const [accounts, setAccounts] = useState<AccountRecord[]>(() =>
    ACCOUNTS.map((a) => ({ ...a })),
  );
  const [thresholds, setThresholds] = useState<DiseaseThreshold[]>(() => [...THRESHOLDS]);
  const [raisedDenial, setRaisedDenial] = useState<(Denial & { path: string }) | null>(
    null,
  );

  // A denial belongs to the screen that raised it, so navigating away retires it.
  const denial = raisedDenial?.path === pathname ? raisedDenial : null;

  const setDenial = useCallback(
    (next: Denial | null) =>
      setRaisedDenial(next ? { ...next, path: pathname } : null),
    [pathname],
  );
  const raiseDenial = useCallback((next: Denial) => setDenial(next), [setDenial]);

  const logActivity = useCallback(
    (kind: ActivityKind, action: string, detail: string) => {
      setActivity((prev) => [
        {
          id: Math.max(0, ...prev.map((a) => a.id)) + 1,
          at: formatStamp(),
          actor: user.name,
          state: scope.state ?? "—",
          kind,
          action,
          detail,
        },
        ...prev,
      ]);
    },
    [user, scope],
  );

  const clearDenial = useCallback(() => setDenial(null), [setDenial]);

  const markNotification = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    const mine = new Set(scopedNotifications(notifications, scope, role.key).map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (mine.has(n.id) ? { ...n, read: true } : n)),
    );
    toast.success("All notifications marked read.");
  }, [notifications, scope, role]);

  const updateAccountPhone = useCallback(
    (id: number, phone: string) => {
      const account = accounts.find((a) => a.id === id);
      if (!account) return false;
      const changed = phone !== (account.phone ?? "");
      if (!changed) {
        toast("No changes to save.");
        return false;
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, phone } : a)));
      logActivity(
        "account",
        "Account updated",
        `${account.name} — alert channel now ${phone ? "SMS" : "email"}`,
      );
      toast.success(
        `${account.name} will now be alerted by ${phone ? "SMS" : "email"}.`,
      );
      return true;
    },
    [accounts, logActivity],
  );

  const toggleAccount = useCallback(
    (id: number) => {
      const account = accounts.find((a) => a.id === id);
      if (!account) return;
      const active = !account.active;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                active,
                note: active
                  ? undefined
                  : `Deactivated ${formatStamp().slice(0, 10)} by ${user.name}`,
              }
            : a,
        ),
      );
      logActivity(
        "account",
        active ? "Account reactivated" : "Account deactivated",
        account.name,
      );
      toast.success(
        active
          ? `${account.name} can sign in again.`
          : `${account.name} can no longer sign in. Their history stays in the audit trail.`,
      );
    },
    [accounts, logActivity, user],
  );

  const resetAccountPassword = useCallback(
    (id: number) => {
      const account = accounts.find((a) => a.id === id);
      if (!account) return;
      logActivity(
        "account",
        "Password reset issued",
        `${account.name} — one-time link sent by ${account.phone ? "SMS" : "email"}`,
      );
      toast.success(`Reset link sent to ${account.name}.`, {
        description: "It expires in 30 minutes and can be used once.",
      });
    },
    [accounts, logActivity],
  );

  const createAccount = useCallback(
    (input: CreateAccountInput) => {
      setAccounts((prev) => [
        ...prev,
        {
          id: Math.max(0, ...prev.map((a) => a.id)) + 1,
          name: input.name,
          role: input.role as Role,
          state: input.state,
          lga: input.lga,
          phone: input.phone,
          email: input.email,
          active: true,
        },
      ]);
      logActivity("account", "Account created", `${input.name} (${input.email})`);
      toast.success("Account created.", {
        description: "The new account can sign in immediately.",
      });
    },
    [logActivity],
  );

  const setAlertLevel = useCallback(
    (disease: string, k: number) => {
      const previous = thresholds.find((t) => t.disease === disease);
      if (!previous) return;
      setThresholds((prev) =>
        prev.map((t) =>
          t.disease === disease ? { ...t, k, setBy: user.name, setAt: formatStamp() } : t,
        ),
      );
      logActivity(
        "config",
        "Alert level changed",
        `${disease} ${previous.k.toFixed(1)}× → ${k.toFixed(1)}×`,
      );
      toast.success(`${disease} alert level set to ${k.toFixed(1)}×.`, {
        description: "It applies at the next detection run.",
      });
    },
    [logActivity, user, thresholds],
  );

  const recordPasswordChange = useCallback(() => {
    logActivity(
      "auth",
      "Password changed",
      "All other sessions on this account were signed out",
    );
    toast.success("Password updated.", {
      description: "Every other session on your account has been signed out.",
    });
  }, [logActivity]);

  const value = useMemo<DashboardValue>(
    () => ({
      user,
      role,
      scope,
      scopeLabel,
      period,
      periods,
      currentPeriod,
      setPeriod,
      openCount,
      notifications,
      activity,
      accounts,
      thresholds,
      denial,
      raiseDenial,
      clearDenial,
      unreadCount: scopedNotifications(notifications, scope, role.key).filter(
        (n) => !n.read,
      ).length,
      markNotification,
      markAllRead,
      updateAccountPhone,
      toggleAccount,
      resetAccountPassword,
      createAccount,
      setAlertLevel,
      recordPasswordChange,
      logActivity,
    }),
    [
      user, role, scope, scopeLabel, period, periods, currentPeriod, setPeriod,
      openCount, notifications, activity, accounts, thresholds,
      denial, raiseDenial, clearDenial,
      markNotification, markAllRead, updateAccountPhone, toggleAccount,
      resetAccountPassword, createAccount, setAlertLevel, recordPasswordChange,
      logActivity,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
