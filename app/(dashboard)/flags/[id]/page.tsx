"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { SignalTag, StatusPill } from "@/components/dashboard/badges";
import { CaseTrendChart } from "@/components/dashboard/case-trend-chart";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
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
import { FACILITY_BY_CODE, PERIODS } from "@/lib/data";
import { caseSeries, monthLabel, movingAverage, periodIndex } from "@/lib/domain";

export default function FlagDetailPage() {
  const params = useParams<{ id: string }>();
  const { flags, thresholds, role } = useDashboard();

  const flag = flags.find((f) => f.id === Number(params.id));

  const series = useMemo(
    () => (flag ? caseSeries(flag.facility, flag.disease, flags) : []),
    [flag, flags],
  );

  if (!flag) {
    return (
      <>
        <PageHeader title="Flag not found" />
        <PageBody>
          <p className="text-muted-foreground text-[0.85rem]">
            No flag with that identifier is visible to your role.
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href={role.home}>Back to your dashboard</Link>
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  const facility = FACILITY_BY_CODE[flag.facility];
  const counts = series.map((s) => s.count);
  const average = movingAverage(counts, 6);
  const alertLevel = thresholds.find((t) => t.disease === flag.disease)?.k ?? 2.0;

  const flaggedPeriods = new Set(
    flags
      .filter(
        (f) =>
          f.facility === flag.facility &&
          f.disease === flag.disease &&
          f.type === "statistical",
      )
      .map((f) => f.period),
  );

  const siblings = flags.filter(
    (f) => f.facility === flag.facility && f.disease === flag.disease,
  );

  const baselineAtFlag = average[periodIndex(flag.period)] ?? 0;

  return (
    <>
      <PageHeader
        title={`${facility.name} — ${flag.disease}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/flags/${flag.id}/audit`}>Audit trail</Link>
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3 pb-1">
          <SignalTag type={flag.type} />
          <StatusPill status={flag.status} />
          <span className="text-muted-foreground text-[0.82rem]">
            {flag.lga} LGA, {flag.state} State
          </span>
          <span className="text-muted-foreground font-mono text-[0.82rem]">
            · {flag.facility}
          </span>
          <span className="text-muted-foreground text-[0.82rem]">
            · Alert level {alertLevel.toFixed(1)}×
          </span>
        </div>

        <DenialNotice />

        <CaseTrendChart
          data={series}
          average={average}
          flaggedPeriods={flaggedPeriods}
          disease={flag.disease}
          facilityName={facility.name}
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
                      value: `Reported without a gap for the ${PERIODS.length - 1} preceding months, which is why the silence is treated as a signal rather than as missing data.`,
                    },
                  ]}
                />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Your decision" description={role.label} />
            <PanelBody>
              <FlagDecision flag={flag} variant="full" />
            </PanelBody>
          </Panel>
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
                          ? `${sibling.cases} cases · ${sibling.z?.toFixed(1)}× usual`
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
