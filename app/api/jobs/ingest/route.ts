import { runIngestion } from "@/lib/dhis2/ingest";

/**
 * The scheduled monthly cycle: pull the month's case counts from DHIS2 and
 * run detection on what arrived.
 *
 *   GET  /api/jobs/ingest                  the latest month held
 *   POST /api/jobs/ingest?period=2026-08   a particular month
 *
 * Both require `Authorization: Bearer $CRON_SECRET`. Vercel Cron issues a
 * GET and sets that header itself from the project's CRON_SECRET; POST is
 * there for running a month by hand.
 */

/** A pull and a detection run take longer than a page render is allowed. */
export const maxDuration = 60;

/** Prisma needs a real Node runtime, not the edge one. */
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // Without a secret configured the job is closed rather than open.
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

export const GET = handle;
export const POST = handle;
