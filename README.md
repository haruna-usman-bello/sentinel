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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate the Prisma client (also runs on install) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed from the reference dataset |

## Layout

```text
app/
  sign-in/           credentials form and the per-tier account picker
  (dashboard)/       one folder per screen, all behind the session guard
  api/auth/          Better Auth route handler
components/
  dashboard/         screens' shared parts: sidebar, tables, charts, dialogs
  ui/                shadcn/ui primitives
lib/
  data.ts            the reference dataset
  domain.ts          scope, period visibility, routing, detector maths
  roles.ts           what each tier can see and do
  validation.ts      Zod schemas
  session.ts         who is signed in, resolved once per request
  auth.ts            Better Auth server config
prisma/
  schema.prisma      domain + Better Auth tables
  migrations/        schema history
  seed.ts            builds the database from lib/data.ts
```
