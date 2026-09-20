import { RoleGate } from "@/components/dashboard/role-gate";
import { listFlags } from "@/lib/queries/flags";
import { resolvePeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";

import { AllFlags } from "./all-flags";

export default async function FlagsPage(props: PageProps<"/flags">) {
  const { role, scope } = await viewer();
  if (role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["state", "national"]} />;
  }

  const { period } = await resolvePeriod((await props.searchParams).period);
  const flags = await listFlags(scope, period);

  return <AllFlags flags={flags} />;
}
