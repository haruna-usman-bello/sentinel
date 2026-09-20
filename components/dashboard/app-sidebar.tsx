"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOutAction } from "@/lib/session-actions";
import { cn } from "@/lib/utils";

function NavBadge({ count, hot }: { count: number; hot: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-[6px] py-px font-mono text-[0.66rem]",
        hot ? "bg-critical text-white" : "bg-white/10 text-sidebar-foreground",
      )}
    >
      {count}
    </span>
  );
}

export function AppSidebar() {
  const { user, role, scopeLabel, openCount, unreadCount } = useDashboard();
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-5 pt-5">
        <div className="font-heading text-[0.95rem] leading-[1.25] font-semibold text-white">
          Sentinel
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-faint font-mono text-[0.6rem] tracking-[0.12em] uppercase">
            {role.label} menu
          </SidebarGroupLabel>
          <SidebarMenu>
            {role.nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} className="text-[0.87rem]">
                    <Link href={item.href}>
                      <span>{item.label}</span>
                      {item.badge === "open" ? (
                        <NavBadge count={openCount} hot={openCount > 0} />
                      ) : null}
                      {item.badge === "notifications" ? (
                        <NavBadge count={unreadCount} hot={unreadCount > 0} />
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border mx-[10px] gap-3 border-t px-[10px] pt-4 pb-5">
        <Link href="/account" className="group block">
          <div className="text-faint font-mono text-[0.66rem] tracking-[0.08em] uppercase">
            Signed in as
          </div>
          <div className="mt-1 text-[0.87rem] leading-[1.3] font-semibold text-white group-hover:underline group-hover:underline-offset-[3px]">
            {user.name}
          </div>
          <div className="mt-[5px] flex items-center gap-[6px] font-mono text-[0.66rem] text-[#7fa39e]">
            <span aria-hidden className="size-[6px] shrink-0 rounded-full bg-[#4e9c86]" />
            {scopeLabel.toUpperCase()}
          </div>
        </Link>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="outline"
            className="text-sidebar-foreground hover:bg-sidebar-accent w-full border-white/15 bg-transparent text-[0.78rem] hover:text-white"
          >
            Sign out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
