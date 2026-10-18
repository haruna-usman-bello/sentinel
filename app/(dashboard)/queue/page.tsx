import Link from "next/link";

import { FlagCard, FlagGroup, FoldedFlagGroup } from "@/components/dashboard/flag-card";
import { FlagDecision } from "@/components/dashboard/flag-decision";
import { DenialNotice } from "@/components/dashboard/notices";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { Button } from "@/components/ui/button";
import { OUTCOME, shortDate } from "@/lib/domain";
import { flagTrails, listFlags, withUsualLevels, type FlagTrail } from "@/lib/queries/flags";
import { currentPeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import type { Flag } from "@/lib/types";

export default async function QueuePage() {
  const { user, role, scope } = await viewer();
  if (role.key !== "supervisor") return <RoleGate allow={["supervisor"]} />;

  // No month picker: the queue is what needs the supervisor now, whichever month it came from.
  const listed = await listFlags(scope, await currentPeriod());
  const [flags, trails] = await Promise.all([withUsualLevels(listed), flagTrails(listed)]);

  const awaiting = flags.filter((f) => f.status === "investigating");
  const confirmed = flags.filter((f) => f.status === "confirmed");
  const notOpened = flags.filter((f) => f.status === "pending");
  const decided = flags.filter((f) => f.status === "false_alarm" || f.status === "closed");

  const who = (actor: string) => (actor === user.name ? "you" : actor);

  /** The line under a card: what the officer found, or who decided it and when. */
  function note(flag: Flag, trail: FlagTrail | undefined): React.ReactNode {
    if (flag.status === "investigating") {
      return trail?.lastFinding ? (
        <>
          <strong className="text-foreground font-semibold">
            Officer&apos;s last finding, {shortDate(trail.lastFinding.at)}:
          </strong>{" "}
          {trail.lastFinding.note}
        </>
      ) : (
        "The officer has not recorded any findings yet."
      );
    }
    if (flag.status === "pending") return "Waiting for the officer to investigate.";
    return `${OUTCOME[flag.status]}${trail?.decision ? ` by ${who(trail.decision.actor)} on ${shortDate(trail.decision.at)}` : ""}.`;
  }

  const card = (flag: Flag) => (
    <FlagCard
      key={flag.id}
      flag={flag}
      note={note(flag, trails.get(flag.id))}
      actions={
        <>
          {/* Deciding happens here; anything else, from the flag itself. */}
          {flag.status === "investigating" || flag.status === "confirmed" ? (
            <FlagDecision flag={flag} variant="card" />
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/flags/${flag.id}`}>Open</Link>
          </Button>
        </>
      }
    />
  );

  return (
    <>
      <PageHeader title="Review queue" />
      <PageBody>

        <DenialNotice />

        <FlagGroup
          title="Awaiting your decision"
          description="The officer has investigated. Read what they found, then decide."
          count={awaiting.length}
          empty="Nothing is waiting for you."
        >
          {awaiting.map(card)}
        </FlagGroup>

        <FlagGroup
          title="Confirmed outbreaks"
          description="Close each one once the response is over."
          count={confirmed.length}
          empty="No outbreak is open."
        >
          {confirmed.map(card)}
        </FlagGroup>

        <FlagGroup
          title="Not yet opened by the officer"
          count={notOpened.length}
          empty="The officer has opened every flag."
        >
          {notOpened.map(card)}
        </FlagGroup>

        <FoldedFlagGroup
          title="Decided"
          count={decided.length}
          empty="Nothing has been dismissed or closed yet."
        >
          {decided.map(card)}
        </FoldedFlagGroup>
      </PageBody>
    </>
  );
}
