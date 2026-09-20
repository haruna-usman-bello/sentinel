import { ZoneCartogram } from "@/components/dashboard/maps";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { stateRollup } from "@/lib/domain";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

export default async function NationalMapPage(props: PageProps<"/national/map">) {
  const { role, scope } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const flags = await listFlags(scope, period);

  return (
    <>
      <PageHeader title="National map" periodScoped />
      <PageBody>

        <ZoneCartogram rollup={stateRollup(flags)} />
      </PageBody>
    </>
  );
}
