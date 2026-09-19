"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { ZoneCartogram } from "@/components/dashboard/maps";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { stateRollup } from "@/lib/domain";

export default function NationalMapPage() {
  return (
    <RoleGate allow={["national"]}>
      <NationalMap />
    </RoleGate>
  );
}

function NationalMap() {
  const { scopedFlags } = useDashboard();

  return (
    <>
      <PageHeader title="National map" periodScoped />
      <PageBody>

        <ZoneCartogram rollup={stateRollup(scopedFlags)} />
      </PageBody>
    </>
  );
}
