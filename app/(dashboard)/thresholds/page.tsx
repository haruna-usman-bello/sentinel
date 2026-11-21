import { RoleGate } from "@/components/dashboard/role-gate";
import { countStatisticalFlagsByDisease } from "@/lib/queries/flags";
import { viewer } from "@/lib/queries/shared";
import { detectorEvaluation, listThresholds } from "@/lib/queries/system";

import { AlertLevels } from "./alert-levels";

export default async function ThresholdsPage() {
  const { role } = await viewer();
  if (role.key !== "national") return <RoleGate allow={["national"]} />;

  const [thresholds, raised, evaluation] = await Promise.all([
    listThresholds(),
    countStatisticalFlagsByDisease(),
    detectorEvaluation(),
  ]);

  return (
    <AlertLevels
      thresholds={thresholds}
      raised={raised}
      recommended={evaluation ? evaluation.recommended.k : null}
    />
  );
}
