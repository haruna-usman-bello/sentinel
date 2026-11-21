import Link from "next/link";

import { Status } from "@/components/dashboard/badges";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatStamp, initialsOf, stampLabel } from "@/lib/domain";
import { recentActivityFor } from "@/lib/queries/activity";
import { listLgas } from "@/lib/queries/facilities";
import { alertRouteFor } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";
import { scopeLabelOf } from "@/lib/roles";
import { signOutAction } from "@/lib/session-actions";

import { ChangePasswordDialog, ThemeSwitch } from "./account-controls";

/** A titled group of settings, each row separated by a hairline. */
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[1rem] font-semibold">{title}</h2>
      <div className="bg-card divide-line-soft divide-y rounded-xl border">{children}</div>
    </section>
  );
}

/** One setting: what it is, its value, and the one thing that can be done with it. */
function SettingsRow({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <div className="text-muted-foreground text-[0.88rem]">{label}</div>
      <div className="min-w-0 text-[0.92rem]">{children}</div>
      {action ? <div className="sm:justify-self-end">{action}</div> : null}
    </div>
  );
}

export default async function AccountPage() {
  const { user, role, signedInAt } = await viewer();
  const [mine, lgas] = await Promise.all([
    recentActivityFor(user.id),
    user.role === "state" && user.state ? listLgas(user.state) : [],
  ]);
  const scopeLabel = scopeLabelOf(user, lgas.length);
  const route = alertRouteFor(user);
  const delivered = route.startsWith("By ");
  // Whoever administers this account is who changes its details.
  const changesBy =
    role.key === "officer" || role.key === "supervisor"
      ? "your state coordinator"
      : role.key === "national"
        ? "the system administrator"
        : null;

  return (
    <>
      <PageHeader title="My account" />
      <PageBody className="max-w-[760px] gap-8">
        <section className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-5">
          <span
            aria-hidden
            className="bg-brand-soft text-brand grid size-14 shrink-0 place-items-center rounded-full text-[1.1rem] font-bold"
          >
            {initialsOf(user.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[1.1rem] font-semibold">{user.name}</span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.9rem]">
              <span className="bg-brand-soft text-brand rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold">
                {role.label}
              </span>
              <span className="text-muted-foreground">{scopeLabel}</span>
            </span>
          </div>
        </section>

        <SettingsSection title="Profile">
          <SettingsRow label="Email">
            <span className="break-all">{user.email}</span>
          </SettingsRow>
          <SettingsRow label="Phone">{user.phone || <span className="text-muted-foreground">None on file</span>}</SettingsRow>
          <SettingsRow label="Posted to">{scopeLabel}</SettingsRow>
          {changesBy ? (
            <p className="text-muted-foreground px-4 py-3 text-[0.86rem] sm:px-5">
              To change your email or phone number, ask {changesBy}.
            </p>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Alerts">
          <SettingsRow label="Where they go">
            <span className="flex flex-col gap-0.5">
              <Status tone={delivered ? "success" : "warning"}>{delivered ? "Delivered" : "Not sent yet"}</Status>
              <span className="text-muted-foreground text-[0.88rem]">
                {delivered ? route : "No alert channel is set up on this system."}
              </span>
            </span>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Security">
          <SettingsRow label="Password" action={<ChangePasswordDialog />}>
            <span className="text-muted-foreground">At least 8 characters. Change it whenever you like.</span>
          </SettingsRow>
          <SettingsRow
            label="Session"
            action={
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            }
          >
            <span className="flex flex-col gap-0.5">
              <span>Signed in {stampLabel(formatStamp(signedInAt))}</span>
              <span className="text-muted-foreground text-[0.88rem]">Ends after 30 minutes without activity.</span>
            </span>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingsRow label="Theme">
            <ThemeSwitch />
          </SettingsRow>
        </SettingsSection>

        <Disclosure title="Your recent activity" count={mine.length}>
          {mine.length ? (
            <ul className="m-0 list-none border-t p-0">
              {mine.map((entry) => (
                <li key={entry.id} className="border-line-soft flex flex-col gap-0.5 border-b py-2.5">
                  <span className="text-[0.9rem] font-medium">{entry.action}</span>
                  <span className="text-muted-foreground text-[0.84rem]">
                    {stampLabel(entry.at)}
                    {entry.detail ? `. ${entry.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-[0.9rem]">Nothing recorded against this account yet.</p>
          )}
          {role.nav.some((n) => n.href === "/activity") ? (
            <Link href="/activity" className="text-brand mt-3 inline-block text-[0.9rem] font-medium hover:underline hover:underline-offset-[3px]">
              Open the full activity log
            </Link>
          ) : null}
        </Disclosure>
      </PageBody>
    </>
  );
}
