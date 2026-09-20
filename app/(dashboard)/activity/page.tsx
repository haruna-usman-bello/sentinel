import { RoleGate } from "@/components/dashboard/role-gate";
import { listActivity } from "@/lib/queries/activity";
import { viewer } from "@/lib/queries/shared";

import { ActivityLog } from "./activity-log";

export default async function ActivityPage() {
  const { role, scope } = await viewer();
  if (role.key !== "sysadmin" && role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["sysadmin", "state", "national"]} />;
  }

  const activity = await listActivity(scope, role.key);

  return <ActivityLog activity={activity} />;
}
