"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { FlagsTable } from "@/components/dashboard/flags-table";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";

export default function QueuePage() {
  return (
    <RoleGate allow={["supervisor"]}>
      <ReviewQueue />
    </RoleGate>
  );
}

function ReviewQueue() {
  const { scopedFlags, scope } = useDashboard();

  const awaiting = scopedFlags.filter((f) => f.status === "investigating");
  const lga = scope.lga;

  return (
    <>
      <PageHeader title="Review queue" periodScoped />
      <PageBody>

        <DenialNotice />

        <StatStrip
          items={[
            {
              value: scopedFlags.filter((f) => f.status === "pending").length,
              label: "Not yet opened",
              tone: "warning",
            },
            { value: awaiting.length, label: "Awaiting your decision" },
            {
              value: scopedFlags.filter((f) => f.status === "confirmed").length,
              label: "Confirmed outbreaks",
              tone: "critical",
            },
            {
              value: scopedFlags.filter((f) => f.status === "closed").length,
              label: "Closed",
              tone: "success",
            },
          ]}
        />

        <Panel>
          <PanelHeader title={`All flags in ${lga} LGA`} />
          <FlagsTable
            flags={scopedFlags}
            showLga={false}
            empty="No flag has been raised in your LGA up to this period."
          />
        </Panel>
      </PageBody>
    </>
  );
}
