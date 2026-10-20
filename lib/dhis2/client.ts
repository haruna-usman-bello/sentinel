import "server-only";

import type { OrgUnit } from "./org-units";

import { dhis2Config, dhis2Url } from "./config";

/**
 * The slice of the DHIS2 Web API this system reads: aggregate data values
 * for a set of organisation units, data elements and one monthly period.
 * Credentials never leave the server.
 */

export interface DataValue {
  dataElement: string;
  period: string;
  orgUnit: string;
  value: string;
  /**
   * Which part of a split figure this is, such as an age band or a sex. DHIS2
   * returns one value per part, and a month's count is the sum of them.
   */
  categoryOptionCombo?: string;
}

export interface DataValueSetQuery {
  orgUnits: string[];
  dataElements: string[];
  /** DHIS2 monthly period, e.g. "202608". */
  period: string;
}

export interface Dhis2Transport {
  fetchDataValueSet(query: DataValueSetQuery): Promise<DataValue[]>;
  /** The organisation units at one level of the hierarchy, with their ancestors and geometry. */
  fetchOrganisationUnits(level: number): Promise<OrgUnit[]>;
  /** Particular organisation units with their geometry — the LGAs, for their outlines. */
  fetchOrganisationUnitsById(ids: string[]): Promise<OrgUnit[]>;
}

/**
 * Facilities per request for data values. Each adds about 20 characters to
 * the address, and servers refuse an address much over 8,000; a pull for a
 * whole state's register would otherwise fail outright.
 */
const ORG_UNITS_PER_REQUEST = 100;
/** Requests in flight at once, so a large register is quick to pull without crowding the server. */
const PARALLEL_REQUESTS = 4;

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

export class Dhis2Error extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "Dhis2Error";
  }
}

/** Talks to a live instance over `GET /api/dataValueSets`. */
export function liveTransport(timeoutMs = 30_000): Dhis2Transport {
  const config = dhis2Config();
  if (!config) {
    throw new Dhis2Error(
      "DHIS2 is not configured: set DHIS2_BASE_URL, and either DHIS2_PAT or DHIS2_USERNAME and DHIS2_PASSWORD.",
    );
  }
  const { authorization } = config;

  async function readUnits(params: URLSearchParams): Promise<OrgUnit[]> {
    const response = await fetch(dhis2Url(config!, `organisationUnits.json?${params}`), {
      headers: { authorization, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Dhis2Error(`HTTP ${response.status} from the DHIS2 endpoint`, response.status);
    }
    const body = (await response.json()) as { organisationUnits?: OrgUnit[] };
    return body.organisationUnits ?? [];
  }

  async function readValues(
    orgUnits: string[],
    dataElements: string[],
    period: string,
  ): Promise<DataValue[]> {
    const params = new URLSearchParams({ period });
    for (const ou of orgUnits) params.append("orgUnit", ou);
    for (const de of dataElements) params.append("dataElement", de);

    const response = await fetch(dhis2Url(config!, `dataValueSets.json?${params}`), {
      headers: { authorization, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Dhis2Error(`HTTP ${response.status} from the DHIS2 endpoint`, response.status);
    }
    const body = (await response.json()) as {
      period?: string;
      orgUnit?: string;
      dataValues?: (Omit<DataValue, "period" | "orgUnit"> & Partial<DataValue>)[];
    };
    // DHIS2 states a field once, at the top, when every value shares it: the
    // month always, and the facility when only one was asked about.
    return (body.dataValues ?? []).map((v) => ({
      ...v,
      period: v.period ?? body.period ?? period,
      orgUnit: v.orgUnit ?? body.orgUnit ?? (orgUnits.length === 1 ? orgUnits[0] : ""),
    }));
  }

  return {
    async fetchDataValueSet({ orgUnits, dataElements, period }) {
      const batches = chunks(orgUnits, ORG_UNITS_PER_REQUEST);
      const values: DataValue[] = [];
      for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
        const answers = await Promise.all(
          batches
            .slice(i, i + PARALLEL_REQUESTS)
            .map((batch) => readValues(batch, dataElements, period)),
        );
        for (const answer of answers) values.push(...answer);
      }
      return values;
    },

    async fetchOrganisationUnits(level) {
      // Ancestors come back with the units themselves, so the hierarchy can be
      // read without walking it one request at a time.
      return readUnits(
        new URLSearchParams({
          filter: `level:eq:${level}`,
          fields: "id,displayName,code,level,ancestors[id,displayName,level],geometry",
          paging: "false",
        }),
      );
    },

    async fetchOrganisationUnitsById(ids) {
      // Only well-formed UIDs go into the filter, which they would otherwise
      // be able to rewrite.
      const uids = ids.filter((id) => /^[A-Za-z][A-Za-z0-9]{10}$/.test(id));
      // An outline can run to thousands of points, so the LGAs are read a few
      // dozen at a time — which also keeps the query string short.
      const units: OrgUnit[] = [];
      for (const batch of chunks(uids, 50)) {
        units.push(
          ...(await readUnits(
            new URLSearchParams({
              filter: `id:in:[${batch.join(",")}]`,
              fields: "id,displayName,level,geometry",
              paging: "false",
            }),
          )),
        );
      }
      return units;
    },
  };
}

/** Answers from memory — for tests and for a pull against a fixture. */
export function fixtureTransport(values: DataValue[], orgUnits: OrgUnit[] = []): Dhis2Transport {
  return {
    async fetchDataValueSet({ orgUnits: units, dataElements, period }) {
      return values.filter(
        (v) =>
          v.period === period && units.includes(v.orgUnit) && dataElements.includes(v.dataElement),
      );
    },
    async fetchOrganisationUnits(level) {
      return orgUnits.filter((u) => u.level === level);
    },
    async fetchOrganisationUnitsById(ids) {
      return orgUnits.filter((u) => ids.includes(u.id));
    },
  };
}
