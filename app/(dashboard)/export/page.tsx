import { RoleGate } from "@/components/dashboard/role-gate";
import { confirmedOutbreaks, listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

import { SituationReport } from "./situation-report";

export default async function ExportPage(props: PageProps<"/export">) {
  const { role, scope } = await viewer();
  if (role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["state", "national"]} />;
  }

  const { period } = await resolvePeriod((await props.searchParams).period);
  // Outbreaks come from the audit trail too: one confirmed and since closed is still an outbreak.
  const [flags, outbreaks] = await Promise.all([
    listFlags(scope, period),
    confirmedOutbreaks(scope, period, null),
  ]);

  return <SituationReport flags={flags} outbreaks={outbreaks} />;
}
