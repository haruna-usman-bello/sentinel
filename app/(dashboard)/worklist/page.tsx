import Link from "next/link";

import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import { isOpen, monthLabel, OUTCOME, shortDate } from "@/lib/domain";
import { flagTrails, listFlags, usualLevels, type FlagTrail } from "@/lib/queries/flags";
import { currentPeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import type { Flag } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The signal in plain words. The figures behind it are on the flag page. */
function signalLine(flag: Flag, usual: number | undefined): string {
  const month = monthLabel(flag.period);
  if (flag.type === "non_reporting") {
    return `No report received for ${month}, though it had been reporting regularly.`;
  }
  return usual === undefined
    ? `${flag.cases} cases in ${month}`
    : `${flag.cases} cases in ${month}, usually about ${Math.round(usual)} a month`;
}

function TaskCard({ flag, usual, trail }: { flag: Flag; usual?: number; trail?: FlagTrail }) {
  const open = isOpen(flag);
  const hot = flag.type === "statistical" && (flag.z ?? 0) >= 3;
  const noteClass =
    "border-line-soft text-muted-foreground mt-[9px] border-t border-dashed pt-2 text-[0.8rem]";

  return (
    <article
      className={cn(
        "bg-card border-border grid grid-cols-1 items-start gap-[14px] rounded-md border border-l-[3px] px-[17px] py-[15px] sm:grid-cols-[1fr_auto]",
        !open ? "border-l-success" : hot ? "border-l-critical" : "border-l-warning",
      )}
    >
      <div className="min-w-0">
        <div className={cn("font-heading text-[0.98rem] font-semibold", !open && "opacity-80")}>
          {flag.facilityName} — {flag.disease}
        </div>
        <div className="text-muted-foreground mt-[3px] text-[0.85rem]">{signalLine(flag, usual)}</div>
        <div className="mt-[9px] flex flex-wrap items-center gap-2">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-faint font-mono text-[0.72rem]">Raised {shortDate(flag.raisedAt)}</span>
        </div>
        {flag.status === "investigating" ? (
          <p className={noteClass}>
            {trail?.lastFinding ? (
              <>
                <strong className="text-foreground font-semibold">
                  Last finding, {shortDate(trail.lastFinding.at)}:
                </strong>{" "}
                {trail.lastFinding.note}
              </>
            ) : (
              "No findings recorded yet."
            )}
          </p>
        ) : null}
        {!open ? (
          <p className={noteClass}>
            {OUTCOME[flag.status]}
            {trail?.decision ? ` by ${trail.decision.actor} on ${shortDate(trail.decision.at)}` : ""}.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        {flag.status === "pending" ? <FlagDecision flag={flag} variant="card" /> : null}
        {flag.status === "investigating" ? (
          <Button asChild size="sm">
            <Link href={`/flags/${flag.id}?add=finding`}>Add finding</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link href={`/flags/${flag.id}`}>Open</Link>
        </Button>
      </div>
    </article>
  );
}

function SectionTitle({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[1.15rem] font-semibold">
      {children}
      <span className="border-border text-muted-foreground rounded-full border px-[7px] font-mono text-[0.7rem] leading-[1.6] font-medium">
        {count}
      </span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-[0.83rem]">{children}</p>;
}

export default async function WorklistPage() {
  const { role, scope } = await viewer();
  if (role.key !== "officer") return <RoleGate allow={["officer"]} />;

  // No month picker: the worklist is what is open now, whichever month it came from.
  const flags = await listFlags(scope, await currentPeriod());
  const [usual, trails] = await Promise.all([usualLevels(flags), flagTrails(flags)]);

  const toInvestigate = flags.filter((f) => f.status === "pending");
  const underInvestigation = flags.filter((f) => f.status === "investigating");
  const decided = flags.filter((f) => !isOpen(f));

  const card = (flag: Flag) => (
    <TaskCard key={flag.id} flag={flag} usual={usual.get(flag.id)} trail={trails.get(flag.id)} />
  );

  return (
    <>
      <PageHeader title="My worklist" />
      <PageBody>

        <DenialNotice />

        <section className="flex flex-col gap-3">
          <SectionTitle count={toInvestigate.length}>To investigate</SectionTitle>
          {toInvestigate.length ? (
            toInvestigate.map(card)
          ) : (
            <Empty>Nothing new to open. You are up to date.</Empty>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <SectionTitle count={underInvestigation.length}>Under investigation</SectionTitle>
            <p className="text-muted-foreground mt-[2px] text-[0.83rem]">
              Waiting for your supervisor to decide. Add what you find as you go.
            </p>
          </div>
          {underInvestigation.length ? (
            underInvestigation.map(card)
          ) : (
            <Empty>Nothing under investigation.</Empty>
          )}
        </section>

        {/* Folded away: it only grows, and nothing in it needs the officer. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <SectionTitle count={decided.length}>Decided</SectionTitle>
            <span className="text-muted-foreground text-[0.8rem] group-open:hidden">Show</span>
            <span className="text-muted-foreground hidden text-[0.8rem] group-open:inline">Hide</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {decided.length ? decided.map(card) : <Empty>No flag has been decided yet.</Empty>}
          </div>
        </details>
      </PageBody>
    </>
  );
}
