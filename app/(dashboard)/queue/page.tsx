import { FlagsTable } from "@/components/dashboard/flags-table";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

export default async function QueuePage(props: PageProps<"/queue">) {
  const { role, scope } = await viewer();
  if (role.key !== "supervisor") return <RoleGate allow={["supervisor"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const flags = await listFlags(scope, period);

  const awaiting = flags.filter((f) => f.status === "investigating");

  return (
    <>
      <PageHeader title="Review queue" periodScoped />
      <PageBody>

        <DenialNotice />

        <StatStrip
          items={[
            {
              value: flags.filter((f) => f.status === "pending").length,
              label: "Not yet opened",
              tone: "warning",
            },
            { value: awaiting.length, label: "Awaiting your decision" },
            {
              value: flags.filter((f) => f.status === "confirmed").length,
              label: "Confirmed outbreaks",
              tone: "critical",
            },
            {
              value: flags.filter((f) => f.status === "closed").length,
              label: "Closed",
              tone: "success",
            },
          ]}
        />

        <Panel>
          <PanelHeader title={`All flags in ${scope.lga} LGA`} />
          <FlagsTable
            flags={flags}
            showLga={false}
            empty="No flag has been raised in your LGA up to this period."
          />
        </Panel>
      </PageBody>
    </>
  );
}
