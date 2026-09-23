import "server-only";

/**
 * Where case counts come from. The credentials live in the environment;
 * nothing here reaches the browser except the endpoint's address.
 */

export interface Dhis2Config {
  baseUrl: string;
  /** The Authorization header value, already formed. */
  authorization: string;
  /** How that header was formed, for the administrator to see. */
  method: "token" | "password";
  /**
   * Pins requests to one API version, e.g. "41" for /api/41/…. Left unset the
   * server's current version is used, which is simpler but moves under you
   * when the instance is upgraded.
   */
  version: string | null;
}

/**
 * DHIS2 supports both a personal access token and a username and password.
 * A token is preferred and is what the DHIS2 documentation recommends for a
 * script or an integration: it can be restricted to GET, given an expiry, and
 * revoked on its own without touching the account's password. Basic
 * authentication sends the password on every request and the DHIS2 docs warn
 * it "may be deprecated in future versions", so it is the fallback.
 */
export function dhis2Config(): Dhis2Config | null {
  const baseUrl = process.env.DHIS2_BASE_URL?.replace(/\/+$/, "");
  if (!baseUrl) return null;

  const version = process.env.DHIS2_API_VERSION?.trim() || null;

  const token = process.env.DHIS2_PAT?.trim();
  if (token) {
    return { baseUrl, authorization: `ApiToken ${token}`, method: "token", version };
  }

  const username = process.env.DHIS2_USERNAME;
  const password = process.env.DHIS2_PASSWORD;
  if (username && password) {
    return {
      baseUrl,
      authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      method: "password",
      version,
    };
  }

  return null;
}

/** True when a live instance is configured; otherwise the held data stands in. */
export function dhis2Configured(): boolean {
  return dhis2Config() !== null;
}

/** The address of an endpoint, honouring a pinned API version. */
export function dhis2Url(config: Dhis2Config, path: string): string {
  const prefix = config.version ? `/api/${config.version}` : "/api";
  return `${config.baseUrl}${prefix}/${path.replace(/^\/+/, "")}`;
}

export const DHIS2_SCHEDULE =
  "Monthly, 5th of the month at 06:00 WAT, followed immediately by a detection run";
export const DHIS2_ON_FAILURE =
  "One automatic retry after 15 minutes, then an alert to the national coordinator";
