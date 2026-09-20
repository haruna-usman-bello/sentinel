import Link from "next/link";

import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel, PanelFootnote, PanelHeader } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { Button } from "@/components/ui/button";
import { isOpen, stateRollup } from "@/lib/domain";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

import { StateRollupTable } from "./state-rollup-table";

const TOTAL_STATES = 37;

export default async function NationalPage(props: PageProps<"/national">) {
  const { role, scope } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const { period } = await resolvePeriod((await props.searchParams).period);
  const flags = await listFlags(scope, period);
  const rollup = stateRollup(flags);

  return (
    <>
      <PageHeader
        title="Nigeria — national summary"
        periodScoped
        actions={
          <Button asChild variant="outline">
            <Link href="/export">Export situation report</Link>
          </Button>
        }
      />
      <PageBody>

        <DenialNotice />

        <StatStrip
          items={[
            { value: TOTAL_STATES, label: "States + FCT" },
            { value: flags.length, label: `Flags to ${period}` },
            {
              value: flags.filter(isOpen).length,
              label: "Still open",
              tone: "warning",
            },
            {
              value: flags.filter((f) => f.status === "confirmed").length,
              label: "Confirmed outbreaks",
              tone: "critical",
            },
            {
              value: flags.filter((f) => f.type === "non_reporting").length,
              label: "Facilities not reporting",
            },
          ]}
        />

        <Panel>
          <PanelHeader
            title="States reporting a signal"
            description="Sorted by open flags."
          />
          <StateRollupTable rollup={rollup} />
          <PanelFootnote>
            {TOTAL_STATES - rollup.length} other states and the FCT show no open flag and
            no reporting gap this period and are not listed.
          </PanelFootnote>
        </Panel>
      </PageBody>
    </>
  );
}
