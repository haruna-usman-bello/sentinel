"use client";

import { Tag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { scopedNotifications } from "@/lib/domain";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  return (
    <RoleGate allow={["officer", "supervisor", "state", "national"]}>
      <Notifications />
    </RoleGate>
  );
}

function Notifications() {
  const { notifications, role, markNotification, markAllRead } = useDashboard();

  const mine = scopedNotifications(notifications, role);
  const unread = mine.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title={role.key === "officer" ? "Alerts I received" : "Notifications"}
        actions={
          unread ? (
            <Button variant="outline" onClick={markAllRead}>
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
                      onClick={() => markNotification(n.id)}
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
                              markNotification(n.id);
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
