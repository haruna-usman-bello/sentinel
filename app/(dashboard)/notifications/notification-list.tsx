"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Tag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NotificationList({ notifications: mine }: { notifications: Notification[] }) {
  const { role } = useDashboard();
  const [pending, startTransition] = useTransition();

  const unread = mine.filter((n) => !n.read).length;

  function markRead(id: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <PageHeader
        title={role.key === "officer" ? "Alerts I received" : "Notifications"}
        actions={
          unread ? (
            <Button variant="outline" disabled={pending} onClick={markAllRead}>
              Mark all read ({unread})
            </Button>
          ) : null
        }
      />
      <PageBody>

        <p className="text-muted-foreground text-[0.83rem]">
          Alerts are sent by SMS where the account has a phone number on file, and by
          email otherwise.
        </p>

        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground text-[0.83rem]"
                    >
                      Nothing addressed to you this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  mine.map((n) => (
                    <TableRow
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={cn(
                        "cursor-pointer align-top",
                        n.read
                          ? "text-muted-foreground"
                          : "bg-brand/5 border-l-brand border-l-[3px]",
                      )}
                    >
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {n.read ? null : (
                          <span
                            aria-hidden
                            className="bg-brand mr-[7px] inline-block size-[7px] rounded-full align-[1px]"
                          />
                        )}
                        {n.at}
                      </TableCell>
                      <TableCell>
                        <Tag className="uppercase">{n.channel}</Tag>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{n.recipient}</TableCell>
                      <TableCell className="text-[0.83rem]">{n.message}</TableCell>
                      <TableCell className="text-faint font-mono text-[0.72rem]">
                        {n.read ? (
                          "read"
                        ) : (
                          <button
                            type="button"
                            className="text-brand rounded-sm hover:underline focus-visible:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.id);
                            }}
                          >
                            new · mark read
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
