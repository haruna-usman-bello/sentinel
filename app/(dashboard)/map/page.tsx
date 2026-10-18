import { FacilityMap } from "@/components/dashboard/maps";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { listFacilityPins } from "@/lib/queries/facilities";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

export default async function MapPage(props: PageProps<"/map">) {
  const { role, scope } = await viewer();
  // The supervisor's map is gone until facilities carry real locations; the
  // state coordinator's stays until that screen is reviewed.
  if (role.key !== "state") return <RoleGate allow={["state"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const [facilities, flags] = await Promise.all([
    listFacilityPins(scope),
    listFlags(scope, period),
  ]);

  return (
    <>
      <PageHeader
        title={scope.lga ? `${scope.lga} LGA map` : `${scope.state} facility map`}
        periodScoped
      />
      <PageBody>

        <FacilityMap facilities={facilities} flags={flags} />
      </PageBody>
    </>
  );
}
