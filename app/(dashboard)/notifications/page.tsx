import { RoleGate } from "@/components/dashboard/role-gate";
import { alertChannels, listNotifications } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";

import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
  const { user, role, scope } = await viewer();
  // Officers' and supervisors' alerts reach them by SMS or email and point at
  // their worklist or queue; this screen oversees what was sent across an
  // area, which is the coordinators' job.
  if (role.key !== "state" && role.key !== "national") {
    return <RoleGate allow={["state", "national"]} />;
  }

  const notifications = await listNotifications(scope, role.key, user.id);

  return <NotificationList notifications={notifications} channels={alertChannels()} />;
}
