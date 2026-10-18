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
import type { NotificationView } from "@/lib/queries/notifications";
import type { DeliveryState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What each alert's delivery state means to the person reading the screen. */
const DELIVERY: Record<DeliveryState, { label: string; tone: string; hint: string }> = {
  sent: { label: "sent", tone: "text-success", hint: "Delivered to the address shown." },
  pending: { label: "queued", tone: "text-muted-foreground", hint: "Not sent yet; it goes out on the next run." },
  failed: { label: "not sent", tone: "text-critical", hint: "Delivery failed." },
  skipped: { label: "not sent", tone: "text-warning", hint: "No alert channel is configured on this system." },
};

export function NotificationList({
  notifications,
  channels,
}: {
  notifications: NotificationView[];
  channels: { sms: boolean; email: boolean };
}) {
  const { role } = useDashboard();
  const [pending, startTransition] = useTransition();

  // Only alerts addressed to the viewer are theirs to read; the rest are oversight.
  const unread = notifications.filter((n) => n.mine && !n.read).length;

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

        {channels.sms || channels.email ? (
          <p className="text-muted-foreground text-[0.83rem]">
            {channels.sms && channels.email
              ? "Alerts go out by SMS where the account has a phone number on file, and by email otherwise."
              : channels.sms
                ? "Alerts go out by SMS, to accounts with a phone number on file."
                : "Alerts go out by email."}{" "}
            Each one below shows whether it actually left the system.
          </p>
        ) : (
          <div
            role="status"
            className="border-warning/45 bg-warning-soft rounded-md border px-[15px] py-[13px] text-[0.83rem]"
          >
            <strong className="text-warning font-semibold">
              No alert channel is configured, so nothing is being delivered.
            </strong>{" "}
            Alerts are recorded and shown here, but no SMS or email is sent — the people
            below only see them by opening this screen. Set the provider credentials to
            turn delivery on; anything waiting is sent on the next run.
          </div>
        )}

        <Panel>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground text-[0.83rem]"
                    >
                      No alert has been sent in your area yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow
                      key={n.id}
                      onClick={() => n.mine && !n.read && markRead(n.id)}
                      className={cn(
                        "align-top",
                        n.mine && !n.read
                          ? "bg-brand/5 border-l-brand cursor-pointer border-l-[3px]"
                          : "text-muted-foreground",
                      )}
                    >
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {!n.mine || n.read ? null : (
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
                      <TableCell className="whitespace-nowrap">
                        <span className={cn("text-[0.8rem] font-medium", DELIVERY[n.delivery].tone)}>
                          {DELIVERY[n.delivery].label}
                        </span>
                        <div className="text-faint mt-[2px] font-mono text-[0.68rem]">
                          {n.delivery === "sent" && n.address
                            ? n.address
                            : DELIVERY[n.delivery].hint}
                        </div>
                      </TableCell>
                      <TableCell className="text-faint font-mono text-[0.72rem]">
                        {!n.mine ? (
                          // Someone else's alert: their read state, shown but not changeable here.
                          n.read ? "read" : "unread"
                        ) : n.read ? (
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
