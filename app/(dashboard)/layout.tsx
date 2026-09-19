import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { currentSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  return (
    <DashboardProvider user={session.user}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 pb-16">{children}</SidebarInset>
      </SidebarProvider>
    </DashboardProvider>
  );
}
