"use client";

import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requestRefreshAction } from "@/lib/actions/system";
import { isHistorical, monthLabel, monthLong } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * The reporting month in view. Stepping arrows either side; the month itself
 * opens the full list, with the coordinators' refresh tucked underneath it.
 */
function PeriodControl() {
  const { role, period, periods, currentPeriod, setPeriod } = useDashboard();
  const [refreshing, startRefresh] = useTransition();
  const index = periods.indexOf(period);
  // A pull covers the whole country, so only the coordinators are offered it.
  const canRefresh = role.key === "state" || role.key === "national";

  function refresh() {
    startRefresh(async () => {
      const id = toast.loading("Refreshing data…");
      const result = await requestRefreshAction();
      if (result.ok) toast.success(result.message, { id, description: result.description });
      else toast.error(result.error, { id });
    });
  }

  return (
    <div className="bg-card flex items-center rounded-full border p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        disabled={index <= 0}
        onClick={() => setPeriod(periods[index - 1])}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={index < 0 && !canRefresh}
          className="hover:bg-secondary focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.88rem] font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:opacity-50"
          aria-label={index < 0 ? "Reporting month" : `Reporting month, ${monthLong(period)}`}
        >
          {refreshing ? <RefreshCw className="text-muted-foreground size-3.5 animate-spin" /> : null}
          {/* Until the first counts arrive there is no month to pick. */}
          {index < 0 ? "No data yet" : (
            <>
              <span className="sm:hidden">{monthLabel(period)}</span>
              <span className="hidden sm:inline">{monthLong(period)}</span>
            </>
          )}
          <ChevronDown className="text-muted-foreground size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[22rem] min-w-52">
          {periods.length ? (
            <>
              <DropdownMenuLabel className="text-muted-foreground text-[0.8rem] font-normal">
                Reporting month
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={period} onValueChange={setPeriod}>
                {[...periods].reverse().map((p) => (
                  <DropdownMenuRadioItem key={p} value={p}>
                    {monthLong(p)}
                    {p === currentPeriod ? (
                      <span className="text-muted-foreground ml-auto pl-3 text-[0.8rem]">Latest</span>
                    ) : null}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          ) : null}
          {canRefresh ? (
            <>
              {periods.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem disabled={refreshing} onSelect={refresh}>
                <RefreshCw /> Refresh data
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        disabled={index < 0 || index === periods.length - 1}
        onClick={() => setPeriod(periods[index + 1])}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

/** Looking back at a past month is easy to forget, so it says so until you return. */
function PastMonthNotice() {
  const { period, currentPeriod, setPeriod } = useDashboard();
  if (!isHistorical(period, currentPeriod)) return null;
  return (
    <div className="bg-warning-soft mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3.5 py-2 text-[0.86rem] sm:mx-6">
      <span>
        Showing {monthLong(period)}. Anything raised after it is hidden.
      </span>
      <button
        type="button"
        onClick={() => setPeriod(currentPeriod)}
        className="text-brand font-semibold underline-offset-[3px] hover:underline"
      >
        Back to {monthLong(currentPeriod)}
      </button>
    </div>
  );
}

/** On a phone the menu folds behind one button; its count keeps the work in sight. */
function MenuButton() {
  const { role, badgeCounts } = useDashboard();
  const primary = role.nav.find((item) => item.badge)?.badge;
  const count = primary ? badgeCounts[primary] : 0;
  return (
    <div className="relative -ml-1 md:hidden">
      <SidebarTrigger className="size-8" aria-label="Open the menu" />
      {count > 0 ? (
        <span className="bg-critical pointer-events-none absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-center text-[0.65rem] leading-4 font-semibold text-white">
          {count}
        </span>
      ) : null}
    </div>
  );
}

/**
 * @param periodScoped screens whose content changes with the reporting month
 *   get the month control; reference screens do not.
 */
export function PageHeader({
  title,
  periodScoped = false,
  actions,
}: {
  title: string;
  periodScoped?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="no-print">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="flex min-w-0 flex-1 basis-[14rem] items-center gap-2">
          <MenuButton />
          <h1 className="min-w-0 text-[1.5rem] leading-tight font-bold tracking-[-0.015em]">{title}</h1>
        </div>
        {periodScoped || actions ? (
          <div className="flex flex-wrap items-center gap-2">
            {periodScoped ? <PeriodControl /> : null}
            {actions}
          </div>
        ) : null}
      </header>
      {periodScoped ? <PastMonthNotice /> : null}
    </div>
  );
}

/** The standard content column beneath a page header. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex max-w-[1120px] flex-col gap-7 px-4 pt-5 pb-10 sm:px-6", className)}>
      {children}
    </div>
  );
}

/** A screen's opening sentence: what needs doing, before any list. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground max-w-[68ch] text-[1.02rem] leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold">
      {children}
    </p>
  );
}
