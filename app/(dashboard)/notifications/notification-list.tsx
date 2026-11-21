"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Status } from "@/components/dashboard/badges";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure, SectionHeading } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { stampLabel } from "@/lib/domain";
import type { NotificationView } from "@/lib/queries/notifications";
import type { DeliveryState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What each alert's delivery state means to the person reading the screen. */
const DELIVERY: Record<DeliveryState, { label: string; tone: "success" | "neutral" | "critical" | "warning"; hint: string }> = {
  sent: { label: "Sent", tone: "success", hint: "Delivered to the address shown." },
  pending: { label: "Queued", tone: "neutral", hint: "Goes out on the next run." },
  failed: { label: "Not sent", tone: "critical", hint: "Delivery failed." },
  skipped: { label: "Not sent", tone: "warning", hint: "No alert channel is set up." },
};

const CHANNEL = { sms: "SMS", email: "email" } as const;

function AlertRow({
  alert,
  busy,
  onRead,
}: {
  alert: NotificationView;
  busy: boolean;
  onRead: (id: string) => void;
}) {
  const fresh = alert.mine && !alert.read;
  const delivery = DELIVERY[alert.delivery];
  return (
    <li className="border-line-soft border-b">
      <div className="grid grid-cols-1 gap-x-5 gap-y-2 px-1 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn("text-[0.93rem]", fresh ? "font-semibold" : "text-muted-foreground")}>
            {fresh ? <span aria-hidden className="bg-brand mr-2 inline-block size-2 rounded-full align-[1px]" /> : null}
            {alert.message}
          </p>
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.84rem]">
            <span>
              {/* The channel is only worth naming once something actually went out on it. */}
              {alert.delivery === "sent"
                ? `To ${alert.recipient} by ${CHANNEL[alert.channel]}`
                : `For ${alert.recipient}`}
              , {stampLabel(alert.at)}
            </span>
            <Status tone={delivery.tone}>{delivery.label}</Status>
            <span className="text-faint">
              {alert.delivery === "sent" && alert.address ? alert.address : delivery.hint}
            </span>
          </span>
        </div>
        {fresh ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onRead(alert.id)}>
            Mark read
          </Button>
        ) : !alert.mine ? (
          <span className="text-faint text-[0.82rem]">{alert.read ? "Read" : "Unread"}</span>
        ) : null}
      </div>
    </li>
  );
}

export function NotificationList({
  notifications,
  channels,
}: {
  notifications: NotificationView[];
  channels: { sms: boolean; email: boolean };
}) {
  const [pending, startTransition] = useTransition();

  // Only alerts addressed to the viewer are theirs to read; the rest are oversight.
  const mine = notifications.filter((n) => n.mine).sort((a, b) => Number(a.read) - Number(b.read));
  const others = notifications.filter((n) => !n.mine);
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

  const row = (n: NotificationView) => <AlertRow key={n.id} alert={n} busy={pending} onRead={markRead} />;

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          unread > 1 ? (
            <Button variant="outline" disabled={pending} onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null
        }
      />
      <PageBody>
        <div className="flex flex-col gap-2">
          <Lead>
            <strong>
              {unread ? `${unread} new ${unread === 1 ? "alert" : "alerts"} for you.` : "Nothing new for you."}
            </strong>{" "}
            {channels.sms || channels.email
              ? channels.sms && channels.email
                ? "Alerts go by SMS to people with a phone number on file, and by email to everyone else."
                : channels.sms
                  ? "Alerts go by SMS to people with a phone number on file."
                  : "Alerts go by email."
              : null}
          </Lead>
          {!channels.sms && !channels.email ? (
            <div role="status" className="bg-warning-soft max-w-[72ch] rounded-lg px-4 py-3 text-[0.9rem]">
              <strong className="font-semibold">No alert channel is set up, so nothing is being delivered.</strong>{" "}
              Alerts are recorded here, and people only see them by opening this screen. Once email or
              SMS is set up, anything waiting goes out on the next run.
            </div>
          ) : null}
        </div>

        <section className="flex flex-col gap-2.5">
          <SectionHeading title="Sent to you" count={mine.length} />
          {mine.length ? (
            <ul className="m-0 list-none border-t p-0">{mine.map(row)}</ul>
          ) : (
            <p className="text-muted-foreground border-t py-3 text-[0.9rem]">No alert has been sent to you yet.</p>
          )}
        </section>

        <Disclosure title="Sent to others in your area" count={others.length} note="For oversight">
          {others.length ? (
            <ul className="m-0 list-none border-t p-0">{others.map(row)}</ul>
          ) : (
            <p className="text-muted-foreground text-[0.9rem]">No alert has gone to anyone else yet.</p>
          )}
        </Disclosure>
      </PageBody>
    </>
  );
}
