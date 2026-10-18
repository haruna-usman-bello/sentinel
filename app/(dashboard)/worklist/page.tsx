import Link from "next/link";

import { FlagCard, FlagGroup, FoldedFlagGroup } from "@/components/dashboard/flag-card";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
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
        <strong className="text-foreground font-semibold">
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

function actions(flag: Flag): React.ReactNode {
  return (
    <>
      {flag.status === "pending" ? <FlagDecision flag={flag} variant="card" /> : null}
      {flag.status === "investigating" ? (
        <Button asChild size="sm">
          <Link href={`/flags/${flag.id}?add=finding`}>Add finding</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <Link href={`/flags/${flag.id}`}>Open</Link>
      </Button>
    </>
  );
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

  const card = (flag: Flag) => (
    <FlagCard key={flag.id} flag={flag} note={note(flag, trails.get(flag.id))} actions={actions(flag)} />
  );

  return (
    <>
      <PageHeader title="My worklist" />
      <PageBody>

        <DenialNotice />

        <FlagGroup
          title="To investigate"
          count={toInvestigate.length}
          empty="Nothing new to open. You are up to date."
        >
          {toInvestigate.map(card)}
        </FlagGroup>

        <FlagGroup
          title="Under investigation"
          description="Waiting for your supervisor to decide. Add what you find as you go."
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
