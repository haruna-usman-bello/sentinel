import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { CaseTrendChart } from "@/components/dashboard/case-trend-chart";
import { FindingForm } from "@/components/dashboard/finding-form";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { FlagList, FlagRow } from "@/components/dashboard/flag-list";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Disclosure,
  Grid2,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  isFinding,
  isOpen,
  monthLabel,
  monthLong,
  movingAverage,
  OUTCOME,
  shortDate,
  stampLabel,
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
        <li key={entry.id} className="border-line-soft flex flex-col gap-0.5 border-t py-2.5 text-[0.9rem]">
          <span className="text-muted-foreground text-[0.8rem]">
            {entry.actor}, {stampLabel(entry.at)}
          </span>
          {entry.note}
        </li>
      ))}
    </ul>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.88rem] font-semibold">{children}</span>;
}

/** "about 3.3 times" — how many times the usual level a count is, said plainly. */
function times(cases: number, usual: number): string {
  const ratio = cases / usual;
  return ratio >= 1.95 ? `${ratio.toFixed(1)} times` : `${Math.round((ratio - 1) * 100)}% above`;
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
  const params = await props.searchParams;
  // Opened from the map, the way back is to the map.
  const back = (params.from === "map" && role.nav.find((n) => n.href === "/map")) || BACK[role.key];
  // "Add finding" on the worklist lands here with the box ready to type in.
  const focus = params.add === "finding";

  const counts = series.map((s) => s.count);
  const average = movingAverage(counts, 6);
  const flaggedPeriods = new Set(
    siblings.filter((f) => f.type === "statistical").map((f) => f.period),
  );
  const baselineAtFlag = average[series.findIndex((s) => s.period === flag.period)] ?? 0;
  const history = series.filter((s) => s.period < flag.period && s.count !== null).length;
  const others = siblings.filter((s) => s.id !== flag.id);
  // The rise's usual level, as the rows quote it, falling back to the chart's average.
  const usual = flag.usual ?? baselineAtFlag;
  const officerFirst = role.key === "officer" && isOpen(flag);

  const whyPanel = (
          <Panel>
            <PanelHeader title="Why this was flagged" />
            <PanelBody className="flex flex-col gap-3">
              {flag.type === "statistical" ? (
                <>
                  <p className="text-[0.95rem]">
                    <strong className="font-semibold">
                      {flag.cases} cases in {monthLong(flag.period)}
                    </strong>
                    {usual > 0
                      ? `, about ${times(flag.cases ?? 0, usual)} the usual ${Math.round(usual)} a month.`
                      : ", where it usually reports none."}
                  </p>
                  <Disclosure title="How the detector judged it" className="-mb-2">
                    <div className="flex flex-col gap-3">
                      <KeyValue
                        items={[
                          { term: "Cases reported", value: `${flag.cases} in ${monthLabel(flag.period)}` },
                          {
                            term: "Usual level",
                            value: `${usual.toFixed(1)} cases a month, averaged over the previous 6 months`,
                          },
                          {
                            term: "Above normal by",
                            value: `${flag.z?.toFixed(2)} × the usual month-to-month variation`,
                          },
                          { term: "Alert level", value: `${flag.k?.toFixed(2)} × for ${flag.disease}` },
                        ]}
                      />
                      <p className="text-muted-foreground text-[0.86rem]">
                        A month is flagged when it rises above the facility&apos;s usual level by more
                        than the alert level&apos;s number of usual month-to-month swings.
                      </p>
                    </div>
                  </Disclosure>
                </>
              ) : (
                <>
                  <p className="text-[0.95rem]">
                    <strong className="font-semibold">No report arrived for {monthLong(flag.period)}</strong>,
                    though the facility had reported for {history} months before it.
                  </p>
                  <p className="text-muted-foreground text-[0.88rem]">
                    A silence only counts once a facility has reported three months running, so this
                    is treated as a signal rather than as missing data.
                  </p>
                </>
              )}
            </PanelBody>
          </Panel>
  );

  return (
    <>
      <PageHeader
        title={`${flag.disease} at ${flag.facilityName}`}
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

        <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-muted-foreground text-[0.88rem]">
            {monthLabel(flag.period)}, {flag.lga} LGA, {flag.state} State. Facility code {flag.facility}
          </span>
        </div>

        <DenialNotice />

        {/*
          The reason in plain words and the reader's own part lead; the chart follows
          as the detailed evidence. An officer working an open flag gets their task
          first and the reason after the chart; everyone else, the reason beside
          their decision, or beside the outcome once it is decided.
        */}
        {officerFirst ? (
          <OfficerPanel flag={flag} findings={findings} focus={focus} />
        ) : (
          <Grid2>
            {whyPanel}
            {!isOpen(flag) ? (
              <OutcomePanel
                flag={flag}
                role={role}
                findings={findings}
                decision={decision}
                viewerName={user.name}
              />
            ) : (
              <DecisionPanel flag={flag} findings={findings} />
            )}
          </Grid2>
        )}

        <CaseTrendChart
          data={series}
          average={average}
          flaggedPeriods={flaggedPeriods}
          disease={flag.disease}
          facilityName={flag.facilityName}
        />

        {officerFirst ? whyPanel : null}

        {others.length ? (
          <Disclosure
            title={`Other flags on ${flag.facilityName} for ${flag.disease}`}
            count={others.length}
          >
            <FlagList>
              {others.map((sibling) => (
                <FlagRow key={sibling.id} flag={sibling} place="none" showStatus />
              ))}
            </FlagList>
          </Disclosure>
        ) : null}
      </PageBody>
    </>
  );
}
