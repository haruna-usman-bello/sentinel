import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { listLgas } from "@/lib/queries/facilities";
import { countOpenFlags } from "@/lib/queries/flags";
import { countUnreadNotifications } from "@/lib/queries/notifications";
import { listPeriods } from "@/lib/queries/periods";
import { scopeLabelOf, scopeOf } from "@/lib/roles";
import { currentSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  // One round trip, not four in a row: on a database a few hundred miles away
  // each of these costs real time, and none of them needs another's answer.
  const scope = scopeOf(session.user);
  const [periods, openCount, unreadCount, lgas] = await Promise.all([
    listPeriods(),
    countOpenFlags(scope),
    countUnreadNotifications(scope, session.user.role),
    session.user.role === "state" && session.user.state ? listLgas(session.user.state) : [],
  ]);
  const currentPeriod = periods[periods.length - 1] ?? new Date().toISOString().slice(0, 7);
  const scopeLabel = scopeLabelOf(session.user, lgas.length);

  return (
    <DashboardProvider
      user={session.user}
      scopeLabel={scopeLabel}
      periods={periods}
      currentPeriod={currentPeriod}
      openCount={openCount}
      unreadCount={unreadCount}
    >
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 pb-16">{children}</SidebarInset>
      </SidebarProvider>
    </DashboardProvider>
  );
}
