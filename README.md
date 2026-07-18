# Booklet Studio

A real, running Next.js app: authentication, orgs/roles, a Postgres-backed data model, and
the full booklet editor UI wired to the API instead of local storage.

- Full product spec (PRD, tier matrix, user flows): [`docs/product-spec.md`](docs/product-spec.md)
- Original standalone prototype (superseded, kept for reference): [`legacy/`](legacy/)

## What's real vs. what's stubbed

**Fully wired:**
- Sign up / log in (NextAuth, credentials provider), each signup creates a personal FREE-tier org
- Dashboard, editor, theme designer, layers, pages, hotspots, audio linking, preview mode —
  all reading and writing through `/api/*` routes to Postgres
- Image/audio uploads go to a presigned S3 URL instead of being inlined as base64
- Free-tier project limit enforced **server-side** (not just in the UI)
- Stripe Checkout session creation + webhook that flips an org's tier on payment

**Stubbed / needs your keys:**
- Asset uploads need real AWS/S3 credentials in `.env` — without them, `POST /api/assets/upload-url`
  will fail at the S3 call. There's a dev-only tier-switch route (`/api/dev/set-tier`, blocked in
  production) so you can test upgrade-gated features without live Stripe keys.
- Multi-artist label UI (roster grouping, comments/approval, scheduling, analytics dashboard),
  audit log viewer, and SSO have working API routes (`/api/orgs/[orgId]/members`,
  `/api/orgs/[orgId]/audit-log`) but no dedicated screens yet — see "What's next" below.

## Setup

```bash
npm install
docker compose up -d              # local Postgres on :5432
cp .env.example .env               # fill in NEXTAUTH_SECRET at minimum to run locally
npx prisma migrate dev --name init
npm run dev
```

Open `http://localhost:3000/signup`, create an account, and you land in `/app` — the full
studio. Your first booklet is free; try creating a second project to see the upgrade modal,
or click a locked theme in the Theme panel.

`NEXTAUTH_SECRET` can be any random 32-byte string for local dev (`openssl rand -base64 32`).
`DATABASE_URL` in `.env.example` already matches the docker-compose Postgres credentials.

Image/audio upload and self-serve billing need real AWS and Stripe credentials respectively —
without them those two specific actions will error, but everything else in the app works
against your local Postgres.

## Project layout

```
app/login, app/signup          Auth pages
app/app/page.tsx                Protected mount point → components/BookletApp.tsx
components/BookletApp.tsx       The entire studio UI: dashboard, editor, theme designer,
                                 layers, pages, preview — all calling lib/api-client.ts
lib/api-client.ts               Typed fetch wrapper the UI uses instead of window.storage
lib/types.ts                    Shared Project/Page/Block/Org types (client + reference)
lib/db.ts, lib/auth.ts          Prisma singleton, NextAuth config
lib/entitlements.ts             Tier → feature/limit lookups
lib/storage.ts                  S3 presigned upload URL generator
app/api/...                     All routes from the original backend scaffold, plus:
  auth/signup                    Creates a user + their personal org
  orgs                           List/create orgs
  assets                         Persist an Asset row after a direct-to-S3 upload
  dev/set-tier                   Dev-only tier switch (blocked outside development)
middleware.ts                   Gates /app/* behind a signed-in session
docker-compose.yml               Local Postgres for development
```

## Tier gating pattern

`lib/entitlements.ts` is the single source of truth for what each tier unlocks. Every
gated route does the same two checks:

1. `canCreateProject(org.tier, currentCount)` — `POST /api/projects`
2. `hasFeature(org.tier, "roles" | "audit_log" | ...)` — org-level routes

Gated responses return HTTP 402 with `{ error, code: "TIER_LIMIT" }`, which
`lib/api-client.ts`'s `ApiError` surfaces with a `.code` property — the UI catches that
specific code to show the upgrade modal rather than a generic error toast.

## What's next

- **Label/Enterprise screens** — the API for member roles, audit logs, and shared theme
  presets exists; the roster/collaboration/analytics UI to go with it doesn't yet
- **Document parsing** (DOCX/PDF/TXT → lyric text) — should be a queued job (BullMQ + Redis,
  or a serverless function), not inline in a request, since large files shouldn't block a
  response
- **Server-rendered export** — the editor's Export menu does real JSON download and
  browser print-to-PDF; a proper web-viewer bundle export and server-rendered high-res PDF
  are still open, per §13 of the product spec
- **Analytics ingestion** — `AnalyticsEvent` exists in the schema; nothing writes to it yet
- **SSO** — NextAuth supports SAML/OIDC providers; wiring one in is the remaining step for
  the Enterprise tier

## Type-checking

```bash
npm run typecheck
```

Note: `prisma generate` downloads its query-engine binary from `binaries.prisma.sh`. If
you're behind a restrictive proxy/allowlist, that domain needs to be reachable — Prisma
Client's generated types are required for this to type-check clean.

