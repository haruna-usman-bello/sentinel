import "server-only";

import { dhis2Config } from "./config";

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
}

export interface DataValueSetQuery {
  orgUnits: string[];
  dataElements: string[];
  /** DHIS2 monthly period, e.g. "202608". */
  period: string;
}

export interface Dhis2Transport {
  fetchDataValueSet(query: DataValueSetQuery): Promise<DataValue[]>;
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
  const { baseUrl, username, password } = dhis2Config();
  if (!baseUrl || !username || !password) {
    throw new Dhis2Error("DHIS2 is not configured: set DHIS2_BASE_URL, DHIS2_USERNAME and DHIS2_PASSWORD.");
  }
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  return {
    async fetchDataValueSet({ orgUnits, dataElements, period }) {
      const params = new URLSearchParams({ period });
      for (const ou of orgUnits) params.append("orgUnit", ou);
      for (const de of dataElements) params.append("dataElement", de);

      const response = await fetch(`${baseUrl}/api/dataValueSets.json?${params}`, {
        headers: { authorization, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Dhis2Error(`HTTP ${response.status} from the DHIS2 endpoint`, response.status);
      }
      const body = (await response.json()) as { dataValues?: DataValue[] };
      return body.dataValues ?? [];
    },
  };
}

/** Answers from memory — for tests and for a pull against a fixture. */
export function fixtureTransport(values: DataValue[]): Dhis2Transport {
  return {
    async fetchDataValueSet({ orgUnits, dataElements, period }) {
      return values.filter(
        (v) =>
          v.period === period && orgUnits.includes(v.orgUnit) && dataElements.includes(v.dataElement),
      );
    },
  };
}
