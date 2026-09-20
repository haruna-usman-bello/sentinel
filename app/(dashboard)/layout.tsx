import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { countOpenFlags } from "@/lib/queries/flags";
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
  const openCount = await countOpenFlags(scopeOf(session.user), currentPeriod);

  return (
    <DashboardProvider
      user={session.user}
      periods={periods}
      currentPeriod={currentPeriod}
      openCount={openCount}
    >
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 pb-16">{children}</SidebarInset>
      </SidebarProvider>
    </DashboardProvider>
  );
}
