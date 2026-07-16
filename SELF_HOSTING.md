# Self-hosting SpinUp

SpinUp is a Next.js 16 app backed by Supabase (Postgres + Auth + Storage). This
guide covers running it on your own server (e.g. the Detoil host).

## 1. Prerequisites

- Node.js 20.x (see `.nvmrc`)
- A Supabase project (hosted at supabase.com, or self-hosted Supabase)
- Optional: a Resend account (email), a Trello API key/secret (board sync)

## 2. Configure secrets

Copy the example file and fill in real values:

```bash
cp .env.example .env.local
```

The app validates these on startup (`src/lib/env.ts`, wired via
`src/instrumentation.ts`) and **refuses to boot** if a required variable is
missing, printing exactly which ones. Required:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server-only key; bypasses RLS |
| `NEXT_PUBLIC_APP_URL` | Public base URL, no trailing slash |

Optional (feature-gated): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`TRELLO_API_KEY`, `TRELLO_API_SECRET`.

### Secret management

Do **not** commit `.env.local`. On the server, provide these via your process
manager or container runtime rather than a file on disk where practical:

- **systemd**: an `EnvironmentFile=` pointing at a root-owned `0600` file.
- **Docker / Compose**: `env_file:` or `--env-file`, or Docker secrets.
- **PaaS**: the platform's encrypted environment/secret store.

The only key that grants trust is `SUPABASE_SERVICE_ROLE_KEY`. Treat it like a
root password: server-side only, never sent to the browser, rotate on exposure.

## 3. Set up the database

Apply the SQL migrations in `supabase/migrations/` in order. With the Supabase
CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or run each file (`001` → `005`) against your database with `psql`. Migration
`005_security_fixes.sql` is required — it closes the privilege-escalation and
cross-tenant holes and is safe to re-run (idempotent).

## 4. Build and run

```bash
npm ci
npm run build
npm run start   # serves on :3000
```

Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front and route
your domain to `127.0.0.1:3000`. Set `NEXT_PUBLIC_APP_URL` to that public URL.

## 5. Security posture notes

- **RLS is enforced, but the app also uses the service-role client** in many
  server actions/routes. Where it does, authorization is checked in code
  (team membership / ownership). Keep that pattern when adding features: if you
  use `createAdminClient()`, you own the access check.
- **API routes are exempt from the auth middleware** (`src/proxy.ts` matcher),
  so each route under `src/app/api/**` authenticates itself.
- **Trello webhooks** are verified by HMAC using `TRELLO_API_SECRET`. Without
  that secret set, inbound webhook events are rejected.
- **Exports storage bucket** is private and scoped to team members by path.

## 6. Health check

After boot, hitting the app with required env unset should fail immediately with
a `[env] Missing required environment variables: …` message — that's the
fail-fast validation working as intended.
