import { RoleGate } from "@/components/dashboard/role-gate";
import { listNotifications } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";

import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
  const { role, scope } = await viewer();
  if (role.key === "sysadmin") {
    return <RoleGate allow={["officer", "supervisor", "state", "national"]} />;
  }

  const notifications = await listNotifications(scope, role.key);

  return <NotificationList notifications={notifications} />;
}
