import { RoleGate } from "@/components/dashboard/role-gate";
import { countStatisticalFlagsByDisease } from "@/lib/queries/flags";
import { viewer } from "@/lib/queries/shared";

import { AlertLevels } from "./alert-levels";

export default async function ThresholdsPage() {
  const { role } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const raised = await countStatisticalFlagsByDisease();

  return <AlertLevels raised={raised} />;
}
