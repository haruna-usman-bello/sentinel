import { runIngestion } from "@/lib/dhis2/ingest";

/**
 * The scheduled monthly cycle, for a cron or a platform scheduler to call:
 *
 *   POST /api/jobs/ingest            Authorization: Bearer $CRON_SECRET
 *   POST /api/jobs/ingest?period=2026-08
 *
 * Without a period it re-pulls the latest month held. Unauthorised calls
 * get nothing but a 401.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = new URL(request.url).searchParams.get("period") ?? undefined;
  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return Response.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }

  const run = await runIngestion({ period });
  return Response.json(run, { status: run.status === "fail" ? 502 : 200 });
}
