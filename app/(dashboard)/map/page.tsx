"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { FacilityMap } from "@/components/dashboard/maps";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { FACILITIES } from "@/lib/data";

export default function MapPage() {
  return (
    <RoleGate allow={["supervisor", "state"]}>
      <ScopedMap />
    </RoleGate>
  );
}

function ScopedMap() {
  const { scopedFlags, scope } = useDashboard();

  const facilities = FACILITIES.filter(
    (f) =>
      f.state === scope.state &&
      (!scope.lga || f.lga === scope.lga) &&
      f.mapX !== undefined,
  );

  return (
    <>
      <PageHeader
        title={scope.lga ? `${scope.lga} LGA map` : `${scope.state} facility map`}
        periodScoped
      />
      <PageBody>

        <FacilityMap facilities={facilities} flags={scopedFlags} />
      </PageBody>
    </>
  );
}
