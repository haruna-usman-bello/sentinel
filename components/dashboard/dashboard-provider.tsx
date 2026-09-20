"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { ROLES, scopeOf } from "@/lib/roles";
import type {
  Denial,
  RoleDefinition,
  Scope,
  SessionUser,
} from "@/lib/types";

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
  /** Dispatches the role oversees that no one has read. */
  unreadCount: number;
  /** A refusal raised by the current screen; navigating away retires it. */
  denial: Denial | null;
  raiseDenial: (denial: Denial) => void;
  clearDenial: () => void;
}

const DashboardContext = createContext<DashboardValue | null>(null);

export function useDashboard(): DashboardValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}

export function DashboardProvider({
  user,
  scopeLabel,
  periods,
  currentPeriod,
  openCount,
  unreadCount,
  children,
}: {
  user: SessionUser;
  scopeLabel: string;
  periods: string[];
  currentPeriod: string;
  openCount: number;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const role = ROLES[user.role];
  const scope = useMemo(() => scopeOf(user), [user]);
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

  const clearDenial = useCallback(() => setDenial(null), [setDenial]);

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
      unreadCount,
      denial,
      raiseDenial,
      clearDenial,
    }),
    [
      user, role, scope, scopeLabel, period, periods, currentPeriod, setPeriod,
      openCount, unreadCount, denial, raiseDenial, clearDenial,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
