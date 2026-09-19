"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ACCOUNTS,
  ACTIVITY,
  CURRENT_PERIOD,
  FACILITY_BY_CODE,
  FLAGS,
  FLAG_LOGS,
  NOTIFICATIONS,
  THRESHOLDS,
} from "@/lib/data";
import {
  humanStatus,
  monthLabel,
  recipientsFor,
  scopedNotifications,
  timestamp,
  visibleFlags,
} from "@/lib/domain";
import { ROLES, scopeLabelOf, scopeOf } from "@/lib/roles";
import type {
  AccountRecord,
  ActivityEntry,
  ActivityKind,
  DiseaseThreshold,
  Flag,
  FlagLogEntry,
  FlagStatus,
  Notification,
  Role,
  RoleDefinition,
  Scope,
  SessionUser,
} from "@/lib/types";
import type { CreateAccountInput } from "@/lib/validation";

export interface Denial {
  title: string;
  body: string;
}

interface DashboardValue {
  user: SessionUser;
  role: RoleDefinition;
  scope: Scope;
  scopeLabel: string;
  period: string;
  setPeriod: (period: string) => void;
  flags: Flag[];
  flagLogs: FlagLogEntry[];
  notifications: Notification[];
  activity: ActivityEntry[];
  accounts: AccountRecord[];
  thresholds: DiseaseThreshold[];
  denial: Denial | null;
  clearDenial: () => void;
  /** Flags inside the role's scope, as of the selected reporting period. */
  scopedFlags: Flag[];
  openCount: number;
  unreadCount: number;
  transitionFlag: (flagId: number, to: FlagStatus, note: string) => void;
  denyTransition: (to: FlagStatus) => void;
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
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const role = ROLES[user.role];
  const scope = useMemo(() => scopeOf(user), [user]);
  const scopeLabel = useMemo(() => scopeLabelOf(user), [user]);
  const pathname = usePathname();

  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [flags, setFlags] = useState<Flag[]>(() => FLAGS.map((f) => ({ ...f })));
  const [flagLogs, setFlagLogs] = useState<FlagLogEntry[]>(() => [...FLAG_LOGS]);
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

  const logActivity = useCallback(
    (kind: ActivityKind, action: string, detail: string) => {
      setActivity((prev) => [
        {
          id: Math.max(0, ...prev.map((a) => a.id)) + 1,
          at: timestamp(),
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

  const transitionFlag = useCallback(
    (flagId: number, to: FlagStatus, note: string) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;

      const facility = FACILITY_BY_CODE[flag.facility];

      setFlagLogs((prev) => [
        ...prev,
        { flag: flagId, at: timestamp(), actor: user.name, from: flag.status, to, note },
      ]);

      logActivity(
        "flag",
        to === "closed" ? "Flag closed" : "Flag status changed",
        `${facility.name} / ${flag.disease} ${flag.period} → ${to}`,
      );

      if (to === "confirmed" || to === "false_alarm") {
        const verb =
          to === "confirmed" ? "confirmed an outbreak" : "recorded a false alarm";
        const dispatches = recipientsFor(flag, to, role)
          .filter((r) => !r.startsWith("No onward"))
          .map((r, i) => ({
            id: Date.now() + i,
            read: false,
            at: timestamp(),
            channel: (r.includes("SMS") ? "sms" : "email") as Notification["channel"],
            recipient: r.replace(/ \((SMS|email)\)$/, ""),
            scope: r.includes("National") ? {} : { state: flag.state },
            message: `Status update — ${facility.name} (${flag.lga} LGA), ${flag.disease}, ${monthLabel(flag.period)}. ${user.name} ${verb}.${note ? ` Note: ${note}` : ""}`,
          }));
        if (dispatches.length) setNotifications((prev) => [...dispatches, ...prev]);
      }

      setFlags((prev) => prev.map((f) => (f.id === flagId ? { ...f, status: to } : f)));
      setDenial(null);

      toast.success(
        `${facility.name} — ${flag.disease} moved to “${humanStatus(to)}”.`,
        {
          description:
            to === "confirmed" || to === "false_alarm"
              ? "Logged to the audit trail and escalated."
              : "Logged to the audit trail.",
        },
      );
    },
    [flags, logActivity, role, user, setDenial],
  );

  const denyTransition = useCallback(
    (to: FlagStatus) => {
      setDenial({
        title: `You do not have permission to mark this flag “${humanStatus(to)}”.`,
        body:
          role.key === "officer"
            ? "Your role can open an investigation and record what you find. Declaring or dismissing an outbreak is your LGA supervisor's decision. The flag has been left unchanged."
            : "That change is not available for this flag at its current stage. The flag has been left unchanged.",
      });
      toast.error("Permission denied. The flag was not changed.");
    },
    [role, setDenial],
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
                  : `Deactivated ${timestamp().slice(0, 10)} by ${user.name}`,
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
          t.disease === disease ? { ...t, k, setBy: user.name, setAt: timestamp() } : t,
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

  const scopedFlags = useMemo(
    () => visibleFlags(flags, scope, period),
    [flags, scope, period],
  );

  const value = useMemo<DashboardValue>(
    () => ({
      user,
      role,
      scope,
      scopeLabel,
      period,
      setPeriod,
      flags,
      flagLogs,
      notifications,
      activity,
      accounts,
      thresholds,
      denial,
      clearDenial,
      scopedFlags,
      openCount: scopedFlags.filter(
        (f) => f.status === "pending" || f.status === "investigating",
      ).length,
      unreadCount: scopedNotifications(notifications, scope, role.key).filter(
        (n) => !n.read,
      ).length,
      transitionFlag,
      denyTransition,
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
      user, role, scope, scopeLabel, period, flags, flagLogs, notifications,
      activity, accounts, thresholds,
      denial, clearDenial, scopedFlags, transitionFlag, denyTransition,
      markNotification, markAllRead, updateAccountPhone, toggleAccount,
      resetAccountPassword, createAccount, setAlertLevel, recordPasswordChange,
      logActivity,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
