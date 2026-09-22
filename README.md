# Sentinel

Early detection of unusual disease case patterns in DHIS2 aggregate reporting.

Case counts are pulled monthly from DHIS2, scored against each facility's own
six-month baseline, and flagged when a month rises more than *k* times the
usual variation — or when a facility that has always reported goes silent.
Flags then move through a five-state lifecycle (pending → investigating →
confirmed / false alarm → closed), with every transition recorded in an
append-only audit trail and escalated by SMS or email to the tier above.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) with React 19
- [shadcn/ui](https://ui.shadcn.com) on Tailwind CSS v4
- [Zod](https://zod.dev) for every form and transition
- [Prisma 7](https://www.prisma.io) on PostgreSQL
- [Better Auth](https://www.better-auth.com) for credentials and sessions
- [Vitest](https://vitest.dev) for the access rules and detector maths

## Getting started

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate        # creates the schema (and the database, if the role may)
npm run db:seed           # loads the reference dataset
npm run dev
```

Open <http://localhost:3000>. In development the sign-in screen also lists
one account per tier; picking one signs in as that account with the seed
password, so every dashboard can be explored straight away.

## Roles

| Tier | Role | Sees | May |
| --- | --- | --- | --- |
| 1 | Surveillance Officer | One LGA | Open an investigation |
| 2 | LGA Supervisor | One LGA | Confirm, dismiss, close |
| 3 | State Coordinator | Every LGA in one state | Confirm, dismiss, close; file the situation report |
| 4 | National Coordinator | The whole country | All of the above; set alert levels; see detector accuracy |
| — | System Administrator | **No case data** | Manage accounts and the DHIS2 connection |

The administrator's separation from case data is deliberate: whoever holds
the DHIS2 credentials should never be the person deciding whether an
outbreak is real. Scope is applied to the query that builds each page, not
by hiding controls, so a direct URL outside a role's tier returns nothing.

## Database

PostgreSQL, through Prisma. `DATABASE_URL` can point at any Postgres you
have; `npx prisma dev` starts a local one if you have none. The reference
dataset in `lib/data.ts` is also the seed, and the seed is destructive: it
clears every table and rebuilds it, so it can be re-run at any time.

Every seeded account signs in with `password123` (override with
`SEED_PASSWORD`). Sessions are Better Auth's: credentials are checked against
the `account` table, a deactivated account is refused at sign-in and on every
later request, and each sign-in is written to the activity log.

## Detection

`lib/detector/core.ts` holds the rule, free of any I/O: a month is scored
against the mean and spread of the facility's own previous six reported
months, and flagged when it rises more than *k* times that spread above the
mean. Two guards keep the arithmetic honest — the spread is floored at one
case, so a single extra case at a very steady facility is not an outbreak,
and a facility needs at least three reported baseline months before it is
scored at all. Silence is a separate rule: it is a signal only where the
facility had reported without a gap for the three months before.

`lib/detector/run.ts` applies that to a whole reporting month, raises the
flags that are due, notifies the LGA supervisor and state coordinator, and
recomputes each facility's reporting record. Re-running a month is safe: a
flag that already exists for a facility, disease, month and type is left
exactly as it is, decisions and all.

## Ingestion

`lib/dhis2/` pulls monthly aggregate case counts from the DHIS2
`dataValueSets` endpoint. Each facility carries the organisation unit it
reports as, and each disease the data element its counts arrive under; a
pull covers the facilities that are mapped, and a mapped facility that
returns nothing has the month recorded as a gap rather than left absent,
which is what the silence rule reads.

Set `DHIS2_BASE_URL`, `DHIS2_USERNAME` and `DHIS2_PASSWORD` to pull from a
live instance. Without them the cycle skips the pull and re-runs detection
on the counts already held — the reference dataset stands in for the feed,
not for the detector.

The cycle runs on a schedule:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://your-host/api/jobs/ingest            # the latest month held
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://your-host/api/jobs/ingest?period=2026-08
```

Any signed-in user can trigger the same cycle from the screen they are on,
and the administrator can from the ingestion screen; every run is recorded.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run test:db` | Integration tests, against the seeded database |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate the Prisma client (also runs on install) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed from the reference dataset |

## Layout

```text
app/
  sign-in/           credentials form, and a per-tier picker in development
  (dashboard)/       one folder per screen, all behind the session guard
  api/auth/          Better Auth route handler
  api/jobs/ingest/   the scheduled monthly cycle
components/
  dashboard/         screens' shared parts: sidebar, tables, charts, dialogs
  ui/                shadcn/ui primitives
lib/
  queries/           every read, scoped to the caller (server only)
  actions/           every write, re-checking the same rules
  detector/          the detection rule, and running it over a month
  dhis2/             the case-count feed and the scheduled cycle
  data.ts            the reference dataset — seed input and test fixture
  domain.ts          scope, period visibility, escalation, presentation
  roles.ts           what each tier can see and do
  validation.ts      Zod schemas
  session.ts         who is signed in, resolved once per request
  auth.ts            Better Auth server config
prisma/
  schema.prisma      domain + Better Auth tables
  migrations/        schema history
  seed.ts            builds the database from lib/data.ts
```
