import Link from "next/link";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Disclosure, KeyValue } from "@/components/dashboard/panel";
import { formatStamp, initialsOf, stampLabel } from "@/lib/domain";
import { recentActivityFor } from "@/lib/queries/activity";
import { listLgas } from "@/lib/queries/facilities";
import { alertRouteFor } from "@/lib/queries/notifications";
import { viewer } from "@/lib/queries/shared";
import { scopeLabelOf } from "@/lib/roles";

import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const { user, role, signedInAt } = await viewer();
  const [mine, lgas] = await Promise.all([
    recentActivityFor(user.id),
    user.role === "state" && user.state ? listLgas(user.state) : [],
  ]);
  const scopeLabel = scopeLabelOf(user, lgas.length);

  return (
    <>
      <PageHeader title="My account" />
      <PageBody className="max-w-[760px]">
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="bg-brand-soft text-brand grid size-14 shrink-0 place-items-center rounded-full text-[1.1rem] font-bold"
            >
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0">
              <div className="text-[1.05rem] font-semibold">{user.name}</div>
              <div className="text-muted-foreground text-[0.9rem]">
                {role.label}, {scopeLabel}
              </div>
            </div>
          </div>

          <KeyValue
            items={[
              { term: "Email", value: <span className="break-all">{user.email}</span> },
              { term: "Phone", value: user.phone || "None on file" },
              { term: "Alerts", value: alertRouteFor(user) },
              {
                term: "Session",
                value: `Signed in ${stampLabel(formatStamp(signedInAt))}. It ends after 30 minutes without activity.`,
              },
            ]}
          />
          {role.key !== "state" && role.key !== "sysadmin" ? (
            <p className="text-muted-foreground text-[0.86rem]">
              To change your phone number or email, ask {role.key === "national" ? "the system administrator" : "your state coordinator"}.
            </p>
          ) : null}
        </section>

        <div>
          <Disclosure title="Change password">
            <div className="max-w-sm">
              <ChangePasswordForm />
            </div>
          </Disclosure>
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
        </div>
      </PageBody>
    </>
  );
}
