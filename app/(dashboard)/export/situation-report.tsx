"use client";

import { useMemo } from "react";
import { toast } from "sonner";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatStamp, isOpen, monthLong } from "@/lib/domain";
import type { Flag } from "@/lib/types";

export function SituationReport({ flags: scopedFlags }: { flags: Flag[] }) {
  const { role, scope, user, period } = useDashboard();

  const area = role.key === "national" ? "Nigeria" : `${scope.state} State`;
  const areaHead =
    role.key === "national"
      ? "National — all states and the FCT"
      : `${scope.state} State`;
  const reference = `IDSR/${period.replace("-", "")}/${role.key === "national" ? "NAT" : "KD"}`;

  const csv = useMemo(
    () =>
      [
        "type,facility,lga,state,disease,period,case_count,z_score,threshold_k,status",
        ...scopedFlags.map((f) =>
          [
            f.type,
            f.facilityName,
            f.lga,
            f.state,
            f.disease,
            f.period,
            f.cases ?? "",
            f.z ? f.z.toFixed(2) : "",
            f.k ? f.k.toFixed(1) : "",
            f.status,
          ].join(","),
        ),
      ].join("\n"),
    [scopedFlags],
  );

  const byDisease = new Map<
    string,
    { flags: number; confirmed: number; silent: number; cases: number }
  >();
  for (const flag of scopedFlags) {
    const row = byDisease.get(flag.disease) ?? {
      flags: 0,
      confirmed: 0,
      silent: 0,
      cases: 0,
    };
    row.flags++;
    if (flag.status === "confirmed") row.confirmed++;
    if (flag.type === "non_reporting") row.silent++;
    row.cases += flag.cases ?? 0;
    byDisease.set(flag.disease, row);
  }

  const confirmed = scopedFlags.filter((f) => f.status === "confirmed");
  const silentCount = scopedFlags.filter((f) => f.type === "non_reporting").length;

  function download() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `situation-report-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloading situation-report-${period}.csv`);
  }

  return (
    <>
      <PageHeader
        title="Monthly situation report"
        periodScoped
        actions={
          <Button className="no-print" onClick={() => window.print()}>
            Print / save as PDF
          </Button>
        }
      />
      <PageBody>

        {/* Fixed print styling: this document is issued on paper, so it does not follow the app theme. */}
        <article className="border-border max-w-[760px] rounded-md border bg-white px-11 py-10 text-[0.87rem] leading-[1.6] text-[#16211f] print:max-w-none print:border-none print:p-0">
          <header className="mb-5 flex items-start justify-between gap-5 border-b-2 border-[#16211f] pb-[13px]">
            <div>
              <div className="font-heading text-[1.05rem] font-bold">
                Nigeria Centre for Disease Control
              </div>
              <div className="text-[0.8rem] text-[#5d6b66]">
                Integrated Disease Surveillance and Response — monthly situation report
              </div>
            </div>
            <div className="text-right font-mono text-[0.68rem] leading-[1.7] text-[#5d6b66]">
              {monthLong(period).toUpperCase()}
              <br />
              {areaHead.toUpperCase()}
              <br />
              ISSUED {formatStamp()}
              <br />
              REF {reference}
            </div>
          </header>

          <h3 className="mb-[6px] text-[0.95rem] font-semibold text-[#16211f]">
            1. Summary
          </h3>
          <p className="m-0 mb-[10px]">
            {scopedFlags.length} signal{scopedFlags.length === 1 ? "" : "s"} were under
            review in {area} during {monthLong(period)}, of which{" "}
            {scopedFlags.filter(isOpen).length} remain open and {confirmed.length} have
            been confirmed as outbreaks. {silentCount} facilit
            {silentCount === 1 ? "y" : "ies"} failed to submit an expected report and{" "}
            {silentCount === 1 ? "has" : "have"} been followed up as a
            reporting-completeness concern.
          </p>

          <h3 className="mt-[18px] mb-[6px] text-[0.95rem] font-semibold text-[#16211f]">
            2. Signals by disease
          </h3>
          <table className="my-2 w-full border-collapse text-[0.79rem]">
            <thead>
              <tr>
                {["Disease", "Signals", "Confirmed", "Non-reporting", "Cases reported"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-[#c9d3ce] bg-[#f0f3f1] px-2 py-[6px] text-left font-medium text-[#5d6b66]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...byDisease.entries()].map(([disease, row]) => (
                <tr key={disease}>
                  <td className="border-b border-[#e4eae7] px-2 py-[6px] font-semibold">
                    {disease}
                  </td>
                  <td className="border-b border-[#e4eae7] px-2 py-[6px]">{row.flags}</td>
                  <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                    {row.confirmed || "—"}
                  </td>
                  <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                    {row.silent || "—"}
                  </td>
                  <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                    {row.cases || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-[18px] mb-[6px] text-[0.95rem] font-semibold text-[#16211f]">
            3. Confirmed outbreaks
          </h3>
          {confirmed.length ? (
            <table className="my-2 w-full border-collapse text-[0.79rem]">
              <thead>
                <tr>
                  {["Facility", "LGA", "Disease", "Month", "Cases"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-[#c9d3ce] bg-[#f0f3f1] px-2 py-[6px] text-left font-medium text-[#5d6b66]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmed.map((flag) => (
                  <tr key={flag.id}>
                    <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                      {flag.facilityName}
                    </td>
                    <td className="border-b border-[#e4eae7] px-2 py-[6px]">{flag.lga}</td>
                    <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                      {flag.disease}
                    </td>
                    <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                      {flag.period}
                    </td>
                    <td className="border-b border-[#e4eae7] px-2 py-[6px]">
                      {flag.cases ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0">
              No outbreak was confirmed in {area} during this reporting period.
            </p>
          )}

          <h3 className="mt-[18px] mb-[6px] text-[0.95rem] font-semibold text-[#16211f]">
            4. Method
          </h3>
          <p className="m-0">
            Signals are raised by a moving-average / z-score detector over a six-month
            baseline, at a per-disease threshold k. Reporting-completeness flags are
            raised where a facility with an established reporting history submits nothing
            for the expected period.
          </p>

          <div className="mt-[34px] grid grid-cols-2 gap-7 text-[0.78rem]">
            <div className="mt-[38px] border-t border-[#16211f] pt-[6px] text-[#5d6b66]">
              Prepared by — {user.name}
            </div>
            <div className="mt-[38px] border-t border-[#16211f] pt-[6px] text-[#5d6b66]">
              Approved by — State Epidemiologist
            </div>
          </div>
        </article>

        <Panel className="no-print">
          <PanelHeader
            title="Data export"
            description={
              <>
                <span className="font-mono">situation-report-{period}.csv</span> ·{" "}
                {scopedFlags.length} rows
              </>
            }
            actions={
              <Button variant="outline" onClick={download}>
                Download CSV
              </Button>
            }
          />
          <PanelBody>
            <pre className="bg-rail-deep m-0 overflow-x-auto rounded-md p-[14px] font-mono text-[0.74rem] leading-[1.7] text-[#cfe0dc]">
              {csv}
            </pre>
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
