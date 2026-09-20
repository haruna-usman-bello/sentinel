import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { countOpenFlags } from "@/lib/queries/flags";
import { countUnreadNotifications } from "@/lib/queries/notifications";
import { listPeriods } from "@/lib/queries/periods";
import { scopeOf } from "@/lib/roles";
import { currentSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  const periods = await listPeriods();
  const currentPeriod = periods[periods.length - 1] ?? new Date().toISOString().slice(0, 7);
  const scope = scopeOf(session.user);
  const [openCount, unreadCount] = await Promise.all([
    countOpenFlags(scope, currentPeriod),
    countUnreadNotifications(scope, session.user.role),
  ]);

  return (
    <DashboardProvider
      user={session.user}
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
