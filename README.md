# SpinUp

SpinUp is a startup accelerator platform for South African founders. Teams work
through a structured, phase-based journey — from validating an idea to scaling a
post–product-market-fit company — using a suite of guided tools that produce
real, exportable deliverables. It also includes a job board connecting founders
with talent, a mentor network, and an admin console.

The platform can hand a team's work off directly into a **Detoil** setup: export
all deliverables as a Notion-importable bundle laid out in the standard Detoil
company folder structure.

## Tech stack

- **Next.js 16** (App Router, Server Actions) · **React 19** · **TypeScript**
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Tailwind CSS v4** with **shadcn/ui** (Radix primitives)
- **Resend** for transactional email · **Trello** board sync (optional)
- **docx** for Word exports · **JSZip** for the Detoil/Notion bundle
- **Zod** + **react-hook-form** for validation

## How it works

Founders create a **team**, then move through four phases, each with dedicated
tools:

1. **Validate** — hypothesis tracker, customer interview scripts, problem–solution
   fit, competitive landscape.
2. **Build Minimum** — MVP definition, unit economics, runway calculator, pricing
   experiments.
3. **Sell & Iterate** — PMF dashboard, pitch deck, financial model, SA compliance
   checklist.
4. **Scale** — scaling readiness, GTM playbook, hiring & org design, OKRs, board
   toolkit, fundraising pipeline, market expansion, and more.

Cross-phase tools (weekly journal, funding tracker, advisor network) run
throughout. Each completed tool becomes an **artifact** that can be exported to
`.docx`, or bundled for Detoil/Notion.

Access is team-scoped and multi-tenant. Members are **entrepreneurs** (edit) or
**mentors** (view + guidance notes); platform **admins** manage teams, users, and
mentor applications.

## Getting started

Requires Node 20.x (see `.nvmrc`) and a Supabase project.

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env.local   # then fill in the values

# 3. Apply database migrations (supabase/migrations, 001 → 005)
supabase db push             # or run each .sql file against your database

# 4. Run the dev server
npm run dev                  # http://localhost:3000
```

The app validates required environment variables on startup and refuses to boot
if any are missing, printing exactly which ones.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Browser client key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Secret** server-only key; bypasses RLS |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL, no trailing slash |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | — | Outbound email (invites, outreach, mentor apps) |
| `TRELLO_API_KEY` / `TRELLO_API_SECRET` | — | Trello board sync (secret verifies webhooks) |

See [`.env.example`](./.env.example) for the annotated list.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  app/
    (app)/           Authenticated app: dashboard, teams, tools, jobs, admin
    (auth)/          Sign-in / sign-up / password reset
    api/             Route handlers (Trello, exports, mentor-apply, …)
    about, mentors   Public marketing pages
  components/        UI (shadcn), tool editors, jobs, marketing
  lib/
    supabase/        Client / server / admin (service-role) / middleware
    export/          docx renderers + Detoil/Notion bundle builder
    teams/           Authorization + invite acceptance helpers
    jobs/            Job-board schemas, types, context loaders
    tools/           Tool context loader
    types/           Database types
supabase/migrations/ SQL schema + RLS policies (001 → 005)
```

## Security model

- **Row Level Security** is enabled on every table; policies gate reads/writes by
  team membership and platform role.
- Several server actions and route handlers use the **service-role client**, which
  bypasses RLS — in those places authorization is enforced in code (team
  membership / ownership). If you add a feature that uses `createAdminClient()`,
  you own the access check.
- **API routes are exempt from the auth middleware** (`src/proxy.ts` matcher), so
  each route under `src/app/api/**` authenticates itself.
- Trello webhooks are verified by HMAC (`TRELLO_API_SECRET`); the exports storage
  bucket is private and scoped to team members.

## Detoil / Notion export

From a team's **Settings → Exports**, "Export for Detoil (Notion import)"
downloads a `.zip` of Markdown files arranged in the standard Detoil folder
structure. Import it into Notion via **Import → Markdown & CSV** (folders become
nested pages) to get running with Detoil, with the team's work already filed in
the right place.

## Deployment

See [`SELF_HOSTING.md`](./SELF_HOSTING.md) for running SpinUp on your own server
(secrets, migrations, build/run, reverse proxy, and the security posture).
