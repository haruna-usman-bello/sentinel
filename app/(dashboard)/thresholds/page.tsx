import { RoleGate } from "@/components/dashboard/role-gate";
import { countStatisticalFlagsByDisease } from "@/lib/queries/flags";
import { viewer } from "@/lib/queries/shared";
import { listThresholds } from "@/lib/queries/system";

import { AlertLevels } from "./alert-levels";

export default async function ThresholdsPage() {
  const { role } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const [thresholds, raised] = await Promise.all([
    listThresholds(),
    countStatisticalFlagsByDisease(),
  ]);

  return <AlertLevels thresholds={thresholds} raised={raised} />;
}
