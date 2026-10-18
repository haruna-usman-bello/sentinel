import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { CaseTrendChart } from "@/components/dashboard/case-trend-chart";
import { FindingForm } from "@/components/dashboard/finding-form";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Grid2,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isFinding,
  isOpen,
  monthLabel,
  movingAverage,
  OUTCOME,
  shortDate,
  usualPhrase,
} from "@/lib/domain";
import {
  caseSeriesFor,
  flagLogs,
  getFlag,
  siblingFlags,
  withUsualLevels,
} from "@/lib/queries/flags";
import { viewer } from "@/lib/queries/shared";
import type { Flag, FlagLogEntry, Role, RoleDefinition } from "@/lib/types";

import { FlagNotFound } from "./flag-not-found";

/** Findings, newest first, with who recorded each and when. */
function FindingsList({ entries }: { entries: FlagLogEntry[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {entries.map((entry) => (
        <li key={entry.id} className="border-line-soft flex flex-col gap-[2px] border-t py-[9px] text-[0.85rem]">
          <span className="text-faint font-mono text-[0.68rem]">
            {entry.at} · {entry.actor}
          </span>
          {entry.note}
        </li>
      ))}
    </ul>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase">{children}</span>
  );
}

/** Where a role goes back to from a flag: its own list of them. */
const BACK: Partial<Record<Role, { href: string; label: string }>> = {
  officer: { href: "/worklist", label: "My worklist" },
  supervisor: { href: "/queue", label: "Review queue" },
};

/**
 * The officer's side of an open flag: open the investigation, then record
 * what it turns up.
 */
function OfficerPanel({
  flag,
  findings,
  focus,
}: {
  flag: Flag;
  findings: FlagLogEntry[];
  focus: boolean;
}) {
  if (flag.status === "pending") {
    return (
      <Panel>
        <PanelHeader title="Your next step" />
        <PanelBody className="flex flex-col gap-3">
          <p className="text-muted-foreground text-[0.85rem]">
            Open an investigation, then record what you find here.
          </p>
          <FlagDecision flag={flag} variant="full" />
        </PanelBody>
      </Panel>
    );
  }
  return (
    <Panel>
      <PanelHeader
        title="Your findings"
        description="Your supervisor reads these before deciding. Each one goes into the audit trail under your name."
      />
      <PanelBody className="flex flex-col gap-3">
        <FindingForm flagId={flag.id} autoFocus={focus} />
        {findings.length ? (
          <FindingsList entries={findings} />
        ) : (
          <p className="text-muted-foreground text-[0.83rem]">No findings recorded yet.</p>
        )}
      </PanelBody>
    </Panel>
  );
}

/**
 * Whoever decides on an open flag: what the officer found comes first, so it
 * is read before the buttons beneath it are pressed.
 */
function DecisionPanel({ flag, findings }: { flag: Flag; findings: FlagLogEntry[] }) {
  const investigated = flag.status === "investigating";
  return (
    <Panel>
      <PanelHeader
        title="Your decision"
        description={
          investigated
            ? "Read what the officer found, then decide."
            : "The officer has not opened an investigation yet. You can still decide now if you need to."
        }
      />
      <PanelBody className="flex flex-col gap-3">
        {investigated ? (
          <>
            <SubLabel>What the officer found</SubLabel>
            {findings.length ? (
              <FindingsList entries={findings} />
            ) : (
              <p className="text-muted-foreground text-[0.83rem]">
                The officer has not recorded any findings yet.
              </p>
            )}
          </>
        ) : null}
        <FlagDecision flag={flag} variant="full" />
      </PanelBody>
    </Panel>
  );
}

/** How a decided flag was decided, for everyone who opens it, with Close where the reader may close it. */
function OutcomePanel({
  flag,
  role,
  findings,
  decision,
  viewerName,
}: {
  flag: Flag;
  role: RoleDefinition;
  findings: FlagLogEntry[];
  decision: FlagLogEntry | undefined;
  viewerName: string;
}) {
  const canClose = role.can[flag.status].includes("closed");
  const by = decision ? (decision.actor === viewerName ? "you" : decision.actor) : null;
  return (
    <Panel>
      <PanelHeader title="Outcome" />
      <PanelBody className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[0.85rem]">
          {OUTCOME[flag.status]}
          {decision ? ` by ${by} on ${shortDate(decision.at)}` : ""}.
        </p>
        {decision?.note ? (
          <blockquote className="border-border text-muted-foreground m-0 border-l-[3px] px-3 py-2 text-[0.85rem]">
            {decision.note}
          </blockquote>
        ) : null}
        {findings.length ? (
          <>
            <SubLabel>What the officer found</SubLabel>
            <FindingsList entries={findings} />
          </>
        ) : null}
        {canClose ? (
          <>
            <FlagDecision flag={flag} variant="full" />
            <p className="text-muted-foreground text-[0.8rem]">
              {flag.status === "confirmed"
                ? "Close it once the response is over."
                : "Close it to take it off the queue."}
            </p>
          </>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

export default async function FlagDetailPage(props: PageProps<"/flags/[id]">) {
  const { user, role, scope } = await viewer();
  const { id } = await props.params;

  const found = await getFlag(id, scope);
  if (!found) return <FlagNotFound home={role.home} />;

  const [series, related, logs] = await Promise.all([
    caseSeriesFor(found.facility, found.disease),
    siblingFlags(found),
    flagLogs(found.id),
  ]);
  // The siblings include this flag, so one lookup gives every row its usual level.
  const siblings = await withUsualLevels(related);
  const flag = siblings.find((s) => s.id === found.id) ?? found;
  const findings = logs.filter(isFinding).reverse();
  const decision = logs.findLast((l) => !isFinding(l) && l.to === flag.status);
  const back = BACK[role.key];
  // "Add finding" on the worklist lands here with the box ready to type in.
  const focus = (await props.searchParams).add === "finding";

  const counts = series.map((s) => s.count);
  const average = movingAverage(counts, 6);
  const flaggedPeriods = new Set(
    siblings.filter((f) => f.type === "statistical").map((f) => f.period),
  );
  const baselineAtFlag = average[series.findIndex((s) => s.period === flag.period)] ?? 0;
  const history = series.filter((s) => s.period < flag.period && s.count !== null).length;

  return (
    <>
      <PageHeader
        title={`${flag.facilityName} — ${flag.disease}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/flags/${flag.id}/audit`}>Audit trail</Link>
          </Button>
        }
      />
      <PageBody>
        {back ? (
          <Link
            href={back.href}
            className="text-brand -mb-2 inline-flex items-center gap-1 self-start text-[0.85rem] hover:underline hover:underline-offset-[3px]"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pb-1">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-muted-foreground text-[0.82rem]">
            {flag.lga} LGA, {flag.state} State
          </span>
          <span className="text-muted-foreground font-mono text-[0.82rem]">
            · {flag.facility}
          </span>
        </div>

        <DenialNotice />

        <CaseTrendChart
          data={series}
          average={average}
          flaggedPeriods={flaggedPeriods}
          disease={flag.disease}
          facilityName={flag.facilityName}
        />

        <Grid2>
          <Panel>
            <PanelHeader title="Why this was flagged" />
            <PanelBody>
              {flag.type === "statistical" ? (
                <KeyValue
                  items={[
                    {
                      term: "Cases reported",
                      value: (
                        <span className="tnum font-mono">
                          {flag.cases} in {monthLabel(flag.period)}
                        </span>
                      ),
                    },
                    {
                      term: "Usual level",
                      value: (
                        <span className="tnum font-mono">
                          {baselineAtFlag.toFixed(1)} cases a month, averaged over the
                          previous 6 months
                        </span>
                      ),
                    },
                    {
                      term: "Above normal by",
                      value: (
                        <span className="tnum font-mono">
                          {flag.z?.toFixed(2)} × the usual month-to-month variation
                        </span>
                      ),
                    },
                    {
                      term: "Alert level",
                      value: (
                        <span className="tnum font-mono">
                          {flag.k?.toFixed(2)} × for {flag.disease}
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <KeyValue
                  items={[
                    {
                      term: "Expected",
                      value: (
                        <span className="font-mono">{monthLabel(flag.period)}</span>
                      ),
                    },
                    {
                      term: "Received",
                      value: <span className="text-warning font-mono">nothing</span>,
                    },
                    {
                      term: "History",
                      value: `Reported for ${history} of the preceding months, which is why the silence is treated as a signal rather than as missing data.`,
                    },
                  ]}
                />
              )}
            </PanelBody>
          </Panel>

          {!isOpen(flag) ? (
            <OutcomePanel
              flag={flag}
              role={role}
              findings={findings}
              decision={decision}
              viewerName={user.name}
            />
          ) : role.key === "officer" ? (
            <OfficerPanel flag={flag} findings={findings} focus={focus} />
          ) : (
            <DecisionPanel flag={flag} findings={findings} />
          )}
        </Grid2>

        {siblings.length > 1 ? (
          <Panel>
            <PanelHeader title="Other flags on this facility and disease" />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siblings.map((sibling) => (
                    <TableRow key={sibling.id} className="hover:bg-secondary">
                      <TableCell className="tnum font-mono">
                        <Link href={`/flags/${sibling.id}`} className="hover:underline">
                          {monthLabel(sibling.period)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SignalTag type={sibling.type} />
                      </TableCell>
                      <TableCell className="tnum font-mono">
                        {sibling.type === "statistical"
                          ? [`${sibling.cases} cases`, usualPhrase(sibling)].filter(Boolean).join(", ")
                          : "no report"}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={sibling.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        ) : null}
      </PageBody>
    </>
  );
}
