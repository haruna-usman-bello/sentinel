"use client";

import {
  Bell,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileText,
  Flag,
  Gauge,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef } from "react";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { SentinelMark } from "@/components/dashboard/sentinel-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { initialsOf } from "@/lib/domain";
import { signOutAction } from "@/lib/session-actions";
import type { NavItem } from "@/lib/types";

/** Each screen's icon, so the menu can be scanned by shape as well as by word. */
const ICONS: Record<string, LucideIcon> = {
  "/worklist": ClipboardList,
  "/queue": Inbox,
  "/state": LayoutDashboard,
  "/national": LayoutDashboard,
  "/flags": Flag,
  "/map": MapIcon,
  "/national/map": MapIcon,
  "/completeness": ClipboardCheck,
  "/notifications": Bell,
  "/export": FileText,
  "/users": Users,
  "/activity": History,
  "/thresholds": SlidersHorizontal,
  "/detector": Gauge,
  "/ingest": Database,
};

/** A count is shown only when there is something in it. */
function NavCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-critical-soft text-critical ml-auto min-w-5 rounded-full px-1.5 text-center text-[0.72rem] leading-5 font-semibold">
      {count}
    </span>
  );
}

function NavGroup({ items, label }: { items: NavItem[]; label?: string }) {
  const { badgeCounts } = useDashboard();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  if (!items.length) return null;

  return (
    <SidebarGroup className="py-1">
      {label ? (
        <SidebarGroupLabel className="text-faint h-7 text-[0.78rem] font-normal">{label}</SidebarGroupLabel>
      ) : null}
      <SidebarMenu className="gap-px">
        {items.map((item) => {
          // The national map lives under /national, which is the summary's own address.
          const active =
            pathname === item.href ||
            (item.href !== "/national" && pathname.startsWith(`${item.href}/`));
          const Icon = ICONS[item.href];
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={active}
                className="data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground h-9 gap-2.5 text-[0.9rem] transition-colors duration-150 data-active:font-semibold data-active:shadow-[0_0_0_1px_var(--sidebar-border)] data-active:[&>svg]:text-brand motion-reduce:transition-none"
              >
                <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                  {Icon ? <Icon aria-hidden className="text-faint size-4" /> : null}
                  <span>{item.label}</span>
                  {item.badge ? <NavCount count={badgeCounts[item.badge]} /> : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/** Who is signed in, and everything about their own session, in one menu. */
function AccountMenu() {
  const { user, scopeLabel } = useDashboard();
  const { theme, setTheme } = useTheme();
  const signOut = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={signOut} action={signOutAction} className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus-visible:ring-sidebar-ring flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-hidden focus-visible:ring-2">
          <span
            aria-hidden
            className="bg-brand-soft text-brand grid size-8 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold"
          >
            {initialsOf(user.name) || "?"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-foreground truncate text-[0.86rem] font-semibold">{user.name}</span>
            <span className="text-faint truncate text-[0.78rem]">{scopeLabel}</span>
          </span>
          <ChevronsUpDown className="text-faint size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
          <DropdownMenuLabel className="text-muted-foreground text-[0.8rem] font-normal">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound /> My account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <Sun className="text-muted-foreground size-4 dark:hidden" />
              <Moon className="text-muted-foreground hidden size-4 dark:block" />
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor /> Same as this device
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut.current?.requestSubmit()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AppSidebar() {
  const { role } = useDashboard();
  const work = role.nav.filter((item) => !item.manage);
  const manage = role.nav.filter((item) => item.manage);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 pt-5 pb-2">
        <Link href={role.home} className="text-foreground flex items-center gap-2 text-[1rem] font-bold tracking-[-0.01em]">
          <SentinelMark className="text-brand size-[18px]" />
          Sentinel
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-3 px-1">
        <NavGroup items={work} />
        <NavGroup items={manage} label="Manage" />
      </SidebarContent>

      <SidebarFooter className="p-2 pb-3">
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
