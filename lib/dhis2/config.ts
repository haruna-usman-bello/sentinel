import "server-only";

/**
 * Where case counts come from. The URL and credentials live in the
 * environment; nothing here is ever sent to the browser except the
 * endpoint's address.
 */
export interface Dhis2Config {
  baseUrl: string | null;
  username: string | null;
  password: string | null;
}

export function dhis2Config(): Dhis2Config {
  return {
    baseUrl: process.env.DHIS2_BASE_URL?.replace(/\/+$/, "") || null,
    username: process.env.DHIS2_USERNAME || null,
    password: process.env.DHIS2_PASSWORD || null,
  };
}

/** True when a live instance is configured; otherwise the reference dataset stands in. */
export function dhis2Configured(): boolean {
  const { baseUrl, username, password } = dhis2Config();
  return Boolean(baseUrl && username && password);
}

export const DHIS2_SCHEDULE =
  "Monthly, 5th of the month at 06:00 WAT, followed immediately by a detection run";
export const DHIS2_ON_FAILURE =
  "One automatic retry after 15 minutes, then an alert to the national coordinator";
