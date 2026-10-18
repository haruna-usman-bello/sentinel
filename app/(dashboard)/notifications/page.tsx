import { RoleGate } from "@/components/dashboard/role-gate";
import { alertChannels, listNotifications } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";

import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
  const { user, role, scope } = await viewer();
  // An officer's alerts reach them by SMS or email and point at the worklist;
  // this screen oversees what was sent across an area, which is not their job.
  if (role.key === "sysadmin" || role.key === "officer") {
    return <RoleGate allow={["supervisor", "state", "national"]} />;
  }

  const notifications = await listNotifications(scope, role.key, user.id);

  return <NotificationList notifications={notifications} channels={alertChannels()} />;
}
