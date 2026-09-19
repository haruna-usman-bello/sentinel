"use client";

import Link from "next/link";
import { useState } from "react";

import { Tag } from "@/components/dashboard/badges";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialsOf, timestamp } from "@/lib/domain";
import { changePasswordSchema, fieldErrors } from "@/lib/validation";

function ChangePasswordForm() {
  const { recordPasswordChange } = useDashboard();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = changePasswordSchema.safeParse({
      current: form.get("current"),
      next: form.get("next"),
      repeat: form.get("repeat"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    recordPasswordChange();
    event.currentTarget.reset();
  }

  const labelClass =
    "text-faint font-mono text-[0.62rem] tracking-[0.09em] uppercase";

  return (
    <form onSubmit={submit} className="flex flex-col gap-[11px]">
      <div className="flex flex-col gap-1">
        <Label htmlFor="current" className={labelClass}>
          Current password
        </Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.current}
        />
        {errors.current ? (
          <p className="text-critical text-[0.8rem]">{errors.current}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="next" className={labelClass}>
          New password
        </Label>
        <Input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.next}
        />
        {errors.next ? (
          <p className="text-critical text-[0.8rem]">{errors.next}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="repeat" className={labelClass}>
          Repeat new password
        </Label>
        <Input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.repeat}
        />
        {errors.repeat ? (
          <p className="text-critical text-[0.8rem]">{errors.repeat}</p>
        ) : null}
      </div>

      <p className="text-muted-foreground m-0 text-[0.83rem]">
        At least 8 characters. Changing it signs out every other session on your account.
      </p>

      <div>
        <Button type="submit">Update password</Button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  const { user, role, scopeLabel, activity } = useDashboard();

  const mine = activity.filter((a) => a.actor === user.name).slice(0, 4);

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
                    value: `Signed in ${timestamp()} · expires after 30 minutes idle`,
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
