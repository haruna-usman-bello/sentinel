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

A series distinguishes three things, and the distinction matters: a count
that arrived, a month that was collected and came back empty, and a month
never collected at all. Only the second is silence. A facility with no
organisation unit to pull from has not gone quiet — it has never been asked
— and the detector does not judge it.

`lib/detector/run.ts` applies that to a whole reporting month, raises the
flags that are due, notifies the LGA supervisor and state coordinator, and
recomputes each facility's reporting record. Re-running a month is safe: a
flag that already exists for a facility, disease, month and type is left
exactly as it is, decisions and all.

## Alerts

A flag is worth nothing if nobody hears about it, so every raise and every
decision writes an alert to the people responsible — the LGA supervisor and
the state coordinator, and the national coordinator for a confirmed outbreak.

Delivery is separate from the decision on purpose. Alerts are written inside
the same transaction as the decision, and sent afterwards, so a provider being
slow or down can never roll back an outbreak confirmation. Whatever does not
go out stays queued and is retried by the scheduled cycle, which is why that
cycle is worth running even in a month when DHIS2 offers nothing new.

Two channels, each optional and independent: SMS through Twilio and email
through Resend, both plain HTTP calls in `lib/alerts/transport.ts` — swapping
either for a local aggregator means editing that one file. An alert goes by
the channel its recipient is reachable on, and falls back to the other rather
than being dropped: hearing late by email beats not hearing at all.

**Without credentials nothing is delivered**, and the notifications screen
says so rather than implying otherwise. Each alert shows whether it was sent
and to which address, or why it was not. An alert that had nowhere to go is
held rather than expired, and goes out as soon as a channel is configured.

## Measuring the detector

```bash
npm run detector:evaluate
```

A detector cannot be measured against real surveillance data, because nobody
labelled which months were truly outbreaks — that is the question the system
exists to answer. `lib/detector/evaluate.ts` generates a corpus where the
truth is known by construction: ordinary months drawn from each facility's
own level as Poisson counts, outbreak months that level multiplied by a known
amount. It is deterministic given a seed, so a sweep can be re-run and argued
with, and the accuracy screen quotes it rather than a fixture.

Three things the measurement is careful about, all of which change the
answer:

**Precision depends on how common outbreaks are.** The corpus is deliberately
thick with them so every alert level has enough to measure sensitivity
against. Reading precision straight off it would flatter the loosest level, so
sensitivity and the false alarm rate carry over from the corpus while
precision and alert volume are projected to an assumed 5% of facility-months
(`ASSUMED_PREVALENCE`), stated on the screen as the assumption it is.

**A miss and a false alarm are not equally costly.** The recommendation
maximises F2 rather than F1, weighting recall twice as heavily — a missed
outbreak is measured in lives, a false alarm in a supervisor's afternoon. On
this corpus it recommends 1.25×, which holds at every outbreak rate from 2%
to 5%, and happens to be the best level by F1 too.

**The average hides the shape of the failure.** Recall is broken down by the
size of the rise. A 3–4× jump is caught almost every time at any level; a rise
of half again above normal is missed about as often as it is caught. Lowering
the alert level buys most of its extra recall on exactly those subtle cases.

One idea the harness ruled out: varying the alert level by facility rather
than nationally per disease. It looks like a clear win on the corpus it is
tuned against and buys nothing on corpora it has not seen — each facility
carries too few outbreaks, so the tuning fits their noise. `evaluate.test.ts`
holds that result, so it will speak up if a future change makes it pay.

## Ingestion

`lib/dhis2/` pulls monthly aggregate case counts from the DHIS2
`dataValueSets` endpoint. Each facility carries the organisation unit it
reports as, and each disease the data element its counts arrive under; a
pull covers the facilities that are mapped, and a mapped facility that
returns nothing has the month recorded as a gap rather than left absent,
which is what the silence rule reads.

The facility register is read from the same instance. The administrator
imports it from the organisation-unit tree on the ingestion screen: the state
and LGA are taken from the levels above each facility, and each one arrives
with the organisation unit it reports as already attached, so nobody types an
eleven-character identifier by hand. An import is planned and shown in full —
what would be added, attached, renamed, or refused for a clashing code — and
written only once it is confirmed. A unit whose ancestors do not reach the
expected levels is reported rather than guessed at, because a flag filed under
the wrong state is worse than a facility left out. Importing again later picks
up renames and additions; it never removes a facility, because its flags and
audit trail refer to it.

Set `DHIS2_BASE_URL` and a credential to pull from a live instance.
`DHIS2_PAT` is a personal access token and is what the DHIS2 documentation
recommends for an integration — it can be restricted to GET, given an expiry,
and revoked on its own without touching the account's password. A username
and password still work, but basic authentication sends the password on every
request and the DHIS2 docs warn it may be deprecated. `DHIS2_API_VERSION`
pins requests to one version of the API, which is worth setting against an
instance that will be upgraded under you.

The account or token needs read access to `organisationUnits` (including
`ancestors`) and to `dataValueSets`; a data-entry account often cannot read
the organisation-unit tree. Without them the cycle skips the pull and re-runs detection
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

## Deploying

The app is a Node.js server and runs anywhere that hosts one. On Vercel:

1. **A database.** Any managed Postgres. Put the pooled connection string in
   `DATABASE_URL`, and if it goes through a transaction pooler, the direct one
   in `DIRECT_URL` — migrations need a session, which a pooler will not give.
2. **Environment variables.** `DATABASE_URL`, `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`), and `CRON_SECRET`. Add the `DHIS2_*` ones when
   there is an instance to pull from; without them the app runs on whatever
   counts the database already holds. `BETTER_AUTH_URL` must be the address people
   actually visit — the production alias or your custom domain. Each
   deployment trusts its own generated hostname automatically, but not the
   stable alias, so without this sign-in is refused there as cross-origin.
3. **Deploy.** `vercel-build` runs `prisma migrate deploy` before building, so
   the schema travels with the code. Note that a preview deployment migrates
   whichever database its environment points at; give previews their own if
   that matters.
4. **Bootstrap once.** A fresh database has no accounts and therefore no way
   in:

   ```bash
   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run db:bootstrap
   ```

   That creates one administrator and the diseases under surveillance. It is
   additive and safe to re-run. Every other account is then made from the user
   management screen. `npm run db:seed` is **not** for this — it clears every
   table and loads the reference dataset.
5. **The facility register.** Import it from DHIS2 on the ingestion screen,
   which attaches each facility's organisation unit as it goes. Until a
   facility is mapped, nothing is collected from it — and the detector does
   not judge it.

`vercel.json` schedules the monthly cycle for 05:00 UTC on the 5th, which is
06:00 WAT. Vercel Cron issues a `GET` and sets the `Authorization` header from
`CRON_SECRET` itself; the same route takes a `POST` for running a month by
hand. Check your plan's cron limits and the 60-second function ceiling the
route is written against.

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
| `npm run db:seed` | Seed from the reference dataset (destructive) |
| `npm run db:deploy` | Apply migrations to a deployed database |
| `npm run db:bootstrap` | Create the first administrator on an empty database |
| `npm run detector:evaluate` | Re-measure the detector and record the sweep |

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
  detector/          the detection rule, running it, and measuring it
  dhis2/             the case-count feed, the org-unit tree, the cycle
  facilities/        building the register from that tree
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
