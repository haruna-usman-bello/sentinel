"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requestRefreshAction } from "@/lib/actions/system";
import { isHistorical, monthLabel } from "@/lib/domain";

function PeriodControl() {
  const { period, periods, currentPeriod, setPeriod } = useDashboard();
  const index = periods.indexOf(period);

  return (
    <div className="flex flex-wrap items-center gap-[9px]">
      {isHistorical(period, currentPeriod) ? (
        <span className="bg-warning-soft text-warning rounded-full px-2 py-[3px] font-mono text-[0.6rem] tracking-[0.08em] whitespace-nowrap uppercase">
          Historical view
        </span>
      ) : null}
      <div className="bg-secondary border-border flex items-center gap-[7px] rounded-full border px-[6px] py-1">
        <span className="text-faint pl-[7px] font-mono text-[0.6rem] tracking-[0.09em] uppercase">
          Month
        </span>
        <Button
          variant="outline"
          size="icon"
          className="bg-card size-[26px] rounded-full"
          disabled={index === 0}
          onClick={() => setPeriod(periods[index - 1])}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger
            size="sm"
            className="h-7 border-none bg-transparent font-mono text-[0.8rem] shadow-none dark:bg-transparent"
            aria-label="Reporting month"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...periods].reverse().map((p) => (
              <SelectItem key={p} value={p} className="font-mono text-[0.8rem]">
                {monthLabel(p)}
                {p === currentPeriod ? " (current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="bg-card size-[26px] rounded-full"
          disabled={index === periods.length - 1}
          onClick={() => setPeriod(periods[index + 1])}
          aria-label="Next month"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function RefreshButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await requestRefreshAction();
          if (result.ok) toast(result.message, { description: result.description });
          else toast.error(result.error);
        })
      }
    >
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      Refresh data
    </Button>
  );
}

/**
 * @param periodScoped screens whose content changes with the reporting month
 *   get the month stepper and a refresh control; reference screens do not.
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
    <div className="no-print bg-card border-border flex flex-wrap items-center gap-4 border-b px-4 py-[14px] sm:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <div className="min-w-[200px] flex-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      {periodScoped ? <PeriodControl /> : null}
      {periodScoped ? <RefreshButton /> : null}
      {actions}
    </div>
  );
}

/** The standard content column beneath a page header. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[1180px] flex-col gap-[22px] px-4 py-6 sm:px-6">
      {children}
    </div>
  );
}
