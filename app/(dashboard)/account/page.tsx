import Link from "next/link";

import { Tag } from "@/components/dashboard/badges";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import {
  Grid2,
  KeyValue,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/dashboard/panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatStamp, initialsOf } from "@/lib/domain";
import { recentActivityFor } from "@/lib/queries/activity";
import { listLgas } from "@/lib/queries/facilities";
import { viewer } from "@/lib/queries/shared";
import { scopeLabelOf } from "@/lib/roles";

import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const { user, role } = await viewer();
  const [mine, lgas] = await Promise.all([
    recentActivityFor(user.id),
    user.role === "state" && user.state ? listLgas(user.state) : [],
  ]);
  const scopeLabel = scopeLabelOf(user, lgas.length);

  return (
    <>
      <PageHeader title="My account" actions={<ThemeToggle />} />
      <PageBody>

        <Grid2>
          <Panel>
            <PanelHeader title="Profile" />
            <PanelBody>
              <div className="mb-4 flex items-center gap-4">
                <Avatar className="size-[54px]">
                  <AvatarFallback className="bg-primary text-primary-foreground font-heading text-[1.15rem] font-semibold">
                    {initialsOf(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-heading font-semibold">{user.name}</div>
                  <div className="text-muted-foreground text-[0.83rem]">
                    {role.label} · {scopeLabel}
                  </div>
                </div>
              </div>

              <KeyValue
                items={[
                  {
                    term: "Email",
                    value: (
                      <span className="font-mono text-[0.8rem] break-all">
                        {user.email}
                      </span>
                    ),
                  },
                  {
                    term: "Role",
                    value: (
                      <>
                        {role.label} <Tag>{role.tier}</Tag>
                      </>
                    ),
                  },
                  { term: "State", value: user.state ?? "—" },
                  { term: "LGA", value: user.lga ?? "—" },
                  {
                    term: "Alerts by",
                    value: user.phone ? (
                      <>
                        SMS to <span className="font-mono">{user.phone}</span>
                      </>
                    ) : (
                      "Email"
                    ),
                  },
                  {
                    term: "Session",
                    value: `Signed in ${formatStamp()} · expires after 30 minutes idle`,
                  },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Change password"
              description="Your password is stored securely and is never sent to you by email."
            />
            <PanelBody>
              <ChangePasswordForm />
            </PanelBody>
          </Panel>
        </Grid2>

        <Panel>
          <PanelHeader
            title="Your recent activity"
            actions={
              role.nav.some((n) => n.href === "/activity") ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/activity">Full activity log</Link>
                </Button>
              ) : null
            }
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mine.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground text-[0.83rem]"
                    >
                      Nothing recorded against this account yet this session.
                    </TableCell>
                  </TableRow>
                ) : (
                  mine.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="tnum font-mono whitespace-nowrap">
                        {entry.at}
                      </TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell className="text-muted-foreground text-[0.82rem]">
                        {entry.detail}
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
