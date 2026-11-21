import Link from "next/link";

import { FlagGroup, FlagRow, FoldedFlagGroup } from "@/components/dashboard/flag-list";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { Lead, PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import { isOpen, OUTCOME, shortDate } from "@/lib/domain";
import { flagTrails, listFlags, withUsualLevels, type FlagTrail } from "@/lib/queries/flags";
import { currentPeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import type { Flag } from "@/lib/types";

/** The line under a card: the latest finding while it is investigated, then how it was decided. */
function note(flag: Flag, trail: FlagTrail | undefined): React.ReactNode {
  if (flag.status === "investigating") {
    return trail?.lastFinding ? (
      <>
        <strong className="text-foreground font-medium">
          Last finding, {shortDate(trail.lastFinding.at)}:
        </strong>{" "}
        {trail.lastFinding.note}
      </>
    ) : (
      "No findings recorded yet."
    );
  }
  if (!isOpen(flag)) {
    return `${OUTCOME[flag.status]}${trail?.decision ? ` by ${trail.decision.actor} on ${shortDate(trail.decision.at)}` : ""}.`;
  }
  return null;
}

/** The one thing to do from the list; the flag's name opens everything else. */
function actions(flag: Flag): React.ReactNode {
  if (flag.status === "pending") return <FlagDecision flag={flag} variant="card" />;
  if (flag.status === "investigating") {
    return (
      <Button asChild size="sm">
        <Link href={`/flags/${flag.id}?add=finding`}>Add finding</Link>
      </Button>
    );
  }
  return undefined;
}

export default async function WorklistPage() {
  const { role, scope } = await viewer();
  if (role.key !== "officer") return <RoleGate allow={["officer"]} />;

  // No month picker: the worklist is what is open now, whichever month it came from.
  const listed = await listFlags(scope, await currentPeriod());
  const [flags, trails] = await Promise.all([withUsualLevels(listed), flagTrails(listed)]);

  const toInvestigate = flags.filter((f) => f.status === "pending");
  const underInvestigation = flags.filter((f) => f.status === "investigating");
  const decided = flags.filter((f) => !isOpen(f));

  const toOpen = toInvestigate.length;
  const open = underInvestigation.length;
  const flagCount = (n: number) => `${n} ${n === 1 ? "flag" : "flags"}`;
  const where = `in ${scope.lga} LGA`;

  const card = (flag: Flag) => (
    <FlagRow
      key={flag.id}
      flag={flag}
      place="none"
      actionColumn
      note={note(flag, trails.get(flag.id))}
      actions={actions(flag)}
    />
  );

  return (
    <>
      <PageHeader title="My worklist" />
      <PageBody>
        <DenialNotice />

        <Lead>
          {toOpen && open ? (
            <strong>
              {flagCount(toOpen)} to open and {open} under investigation {where}.
            </strong>
          ) : toOpen ? (
            <strong>
              {flagCount(toOpen)} to open {where}.
            </strong>
          ) : open ? (
            <>
              <strong>
                {flagCount(open)} under investigation {where}.
              </strong>{" "}
              Nothing new to open.
            </>
          ) : (
            <strong>Nothing needs you {where} right now.</strong>
          )}
        </Lead>

        <FlagGroup
          title="To investigate"
          hint="Open an investigation, then record what you find."
          count={toInvestigate.length}
          empty="Nothing new to open. You are up to date."
        >
          {toInvestigate.map(card)}
        </FlagGroup>

        <FlagGroup
          title="Under investigation"
          hint="Waiting for your supervisor to decide. Add what you find as you go."
          count={underInvestigation.length}
          empty="Nothing under investigation."
        >
          {underInvestigation.map(card)}
        </FlagGroup>

        <FoldedFlagGroup title="Decided" count={decided.length} empty="No flag has been decided yet.">
          {decided.map(card)}
        </FoldedFlagGroup>
      </PageBody>
    </>
  );
}
