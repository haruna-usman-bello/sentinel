import { AreaMap } from "@/components/dashboard/maps";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { RoleGate } from "@/components/dashboard/role-gate";
import { signalLine } from "@/lib/domain";
import { coarser, drawMap } from "@/lib/geo";
import { listFlags, withUsualLevels } from "@/lib/queries/flags";
import { listMapFacilities, listOutlines } from "@/lib/queries/map";
import { currentPeriod } from "@/lib/queries/periods";
import { viewer } from "@/lib/queries/shared";
import type { FlagStatus, MapSite } from "@/lib/types";

/** Flags still asking something of someone, in the order the review queue shows them. */
const ATTENTION: FlagStatus[] = ["investigating", "confirmed", "pending"];

/** What each of those is waiting on, for whoever is reading. */
const HINT: Record<"supervisor" | "state", Partial<Record<FlagStatus, string>>> = {
  supervisor: {
    investigating: "Awaiting your decision",
    confirmed: "Close once the response is over",
    pending: "Not yet opened by the officer",
  },
  state: {
    investigating: "Awaiting the supervisor's decision",
    confirmed: "Open until the response is over",
    pending: "Not yet opened by the officer",
  },
};

export default async function MapPage() {
  const { role, scope } = await viewer();
  if (role.key !== "supervisor" && role.key !== "state") {
    return <RoleGate allow={["supervisor", "state"]} />;
  }
  const reader = role.key;
  const lgaMap = reader === "supervisor";
  const place = lgaMap ? `${scope.lga} LGA` : `${scope.state} State`;

  // No month picker: like the review queue, the map shows what is open now,
  // whichever month it was raised for.
  const period = await currentPeriod();
  const [facilities, outlines, listed] = await Promise.all([
    listMapFacilities(scope, period),
    listOutlines(scope),
    listFlags(scope, period),
  ]);
  const open = await withUsualLevels(listed.filter((f) => ATTENTION.includes(f.status)));

  // A state is drawn at a smaller scale than an LGA, so its outlines can be
  // coarser, and lighter to send.
  const drawing = drawMap(
    outlines.map((o) => ({ name: o.lga, shape: lgaMap ? o.shape : coarser(o.shape, 0.005) })),
    facilities.map((f) => f.location),
  );

  const sites: MapSite[] = facilities.map((facility, i): MapSite => {
    const flags = open
      .filter((f) => f.facility === facility.code)
      .sort((a, b) => ATTENTION.indexOf(a.status) - ATTENTION.indexOf(b.status));
    const at = drawing?.points[i] ?? null;
    return {
      code: facility.code,
      name: facility.name,
      lga: facility.lga,
      at,
      missing: at
        ? undefined
        : facility.location
          ? `its location in DHIS2 is far outside ${place}`
          : "no location in DHIS2",
      tone: flags.some((f) => f.type === "statistical") ? "rise" : flags.length ? "silent" : "ok",
      lastReport: facility.lastReport,
      flags: flags.map((f) => ({
        id: f.id,
        type: f.type,
        status: f.status,
        disease: f.disease,
        line: signalLine(f),
        hint: HINT[reader][f.status] ?? "",
      })),
    };
  });
  // Most pressing first — a rise, then a missing report — and within each,
  // whatever is waiting on the reader soonest; the map selects the first.
  const rank = (site: MapSite) =>
    ["rise", "silent", "ok"].indexOf(site.tone) * 10 +
    Math.min(...site.flags.map((f) => ATTENTION.indexOf(f.status)), 9);
  sites.sort((a, b) => rank(a) - rank(b));

  return (
    <>
      <PageHeader title={lgaMap ? `${scope.lga} LGA map` : `${scope.state} facility map`} />
      <PageBody>
        <AreaMap
          place={place}
          drawing={drawing}
          sites={sites}
          nameLgas={!lgaMap}
          missingNote={`They still appear in ${lgaMap ? "the review queue" : "All flags"} and on reporting completeness. Once DHIS2 has their right location and the register is read from it again, they appear on the map.`}
        />
      </PageBody>
    </>
  );
}
