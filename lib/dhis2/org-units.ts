/**
 * Turning a DHIS2 organisation-unit tree into a facility register.
 *
 * DHIS2 models geography as a hierarchy whose depth and meaning are each
 * instance's own choice. A Nigerian IDSR instance usually runs
 * national → state → LGA → facility, but nothing enforces that, so the levels
 * this system reads are configurable and shown back before anything is
 * imported. No I/O here: given the units, this decides what would be created.
 */

export interface OrgUnit {
  id: string;
  displayName: string;
  code?: string | null;
  level: number;
  /** Every unit above this one, as DHIS2 returns them. */
  ancestors?: { id: string; displayName: string; level: number }[] | null;
}

/** Which level of the hierarchy means what, for this instance. */
export interface LevelMap {
  state: number;
  lga: number;
  facility: number;
}

export const DEFAULT_LEVELS: LevelMap = { state: 2, lga: 3, facility: 4 };

export interface ResolvedFacility {
  orgUnit: string;
  name: string;
  code: string;
  state: string;
  lga: string;
}

export interface RejectedFacility {
  orgUnit: string;
  name: string;
  /** Said plainly, because the administrator has to fix it in DHIS2. */
  reason: string;
}

export interface ResolutionResult {
  facilities: ResolvedFacility[];
  rejected: RejectedFacility[];
}

/**
 * A facility needs a code: it is what the flag tables, the map and the
 * situation report all print.
 *
 * A code the unit already carries is used as it stands, even where the
 * register holds it too — that is usually the same facility, and matching
 * them is the point. Whether it really is the same one is `planImport`'s
 * decision, not this function's. Only a *derived* code steers clear of the
 * register, since colliding with an existing facility by accident would
 * silently merge two different places.
 */
function codeFor(unit: OrgUnit, batch: Set<string>, reserved: Set<string>): string {
  const carried = unit.code?.trim().toUpperCase().replace(/\s+/g, "");
  if (carried && !batch.has(carried)) return carried;

  // The UID is 11 characters; its first six are enough to stay readable.
  const derived = unit.id.slice(0, 6).toUpperCase();
  const clashes = (code: string) => batch.has(code) || reserved.has(code);
  if (!clashes(derived)) return derived;
  let n = 2;
  while (clashes(`${derived}-${n}`)) n++;
  return `${derived}-${n}`;
}

/**
 * Resolves each unit at the facility level into something importable, or
 * explains why it cannot be. A unit whose ancestors do not reach the state
 * and LGA levels is rejected rather than guessed at — a flag filed under the
 * wrong state is worse than a facility left out.
 */
export function resolveFacilities(
  units: OrgUnit[],
  levels: LevelMap = DEFAULT_LEVELS,
  reservedCodes: string[] = [],
): ResolutionResult {
  const facilities: ResolvedFacility[] = [];
  const rejected: RejectedFacility[] = [];
  const reserved = new Set(reservedCodes.map((c) => c.toUpperCase()));
  const batch = new Set<string>();
  const seen = new Set<string>();

  for (const unit of units) {
    if (unit.level !== levels.facility) continue;
    if (seen.has(unit.id)) continue;
    seen.add(unit.id);

    const ancestors = unit.ancestors ?? [];
    const state = ancestors.find((a) => a.level === levels.state)?.displayName;
    const lga = ancestors.find((a) => a.level === levels.lga)?.displayName;

    if (!state || !lga) {
      const missing = [!state && "state", !lga && "LGA"].filter(Boolean).join(" and ");
      rejected.push({
        orgUnit: unit.id,
        name: unit.displayName,
        reason: `Sits outside the hierarchy — no ${missing} above it at the expected level.`,
      });
      continue;
    }

    const code = codeFor(unit, batch, reserved);
    batch.add(code);
    facilities.push({ orgUnit: unit.id, name: unit.displayName.trim(), code, state, lga });
  }

  return { facilities, rejected };
}

export type ImportOutcome = "new" | "unchanged" | "remapped" | "renamed" | "conflict";

export interface ImportRow extends ResolvedFacility {
  outcome: ImportOutcome;
  /** What the register says now, where that differs. */
  existing?: { code: string; name: string; orgUnit: string | null };
  note?: string;
}

export interface KnownFacility {
  code: string;
  name: string;
  lga: string;
  state: string;
  orgUnit: string | null;
}

/**
 * Compares what DHIS2 offers against the register already held, so the
 * administrator sees what an import would actually change before it happens.
 * Nothing here decides — it only reports.
 */
export function planImport(
  resolved: ResolvedFacility[],
  known: KnownFacility[],
): ImportRow[] {
  const byOrgUnit = new Map(known.filter((f) => f.orgUnit).map((f) => [f.orgUnit!, f]));
  const byCode = new Map(known.map((f) => [f.code.toUpperCase(), f]));

  return resolved.map((facility) => {
    const mapped = byOrgUnit.get(facility.orgUnit);
    if (mapped) {
      if (mapped.name === facility.name && mapped.lga === facility.lga && mapped.state === facility.state) {
        return { ...facility, code: mapped.code, outcome: "unchanged", existing: mapped };
      }
      return {
        ...facility,
        code: mapped.code,
        outcome: "renamed",
        existing: mapped,
        note: `DHIS2 now calls it “${facility.name}” in ${facility.lga}, ${facility.state}.`,
      };
    }

    const sameCode = byCode.get(facility.code.toUpperCase());
    if (sameCode) {
      if (sameCode.orgUnit) {
        return {
          ...facility,
          outcome: "conflict",
          existing: sameCode,
          note: `${sameCode.name} already uses the code ${sameCode.code} and reports as a different organisation unit.`,
        };
      }
      return {
        ...facility,
        outcome: "remapped",
        existing: sameCode,
        note: `Matches ${sameCode.name} on the register, which has no organisation unit yet.`,
      };
    }

    return { ...facility, outcome: "new" };
  });
}

export interface ImportPreview {
  rows: ImportRow[];
  rejected: RejectedFacility[];
  levels: LevelMap;
  /** Units DHIS2 returned at the facility level, before resolution. */
  fetched: number;
}

export type PreviewResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };
