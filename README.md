# Booklet Studio

A real, running Next.js app: authentication, orgs/roles, a Postgres-backed data model, and
the full booklet editor UI wired to the API instead of local storage.

- Full product spec (PRD, tier matrix, user flows): [`docs/product-spec.md`](docs/product-spec.md)
- Original standalone prototype (superseded, kept for reference): [`legacy/`](legacy/)

## What's real vs. what's stubbed

**Fully wired:**
- Sign up / log in (NextAuth, credentials provider), each signup creates a personal FREE-tier org
- Enterprise SSO: per-org OIDC (PKCE) login, provisioned automatically on first sign-in
- Dashboard, editor, theme designer, layers, pages, hotspots, audio linking, preview mode —
  all reading and writing through `/api/*` routes to Postgres
- Team workspace (Team button on the dashboard): roster + roles, audit log, and an
  analytics dashboard (views / hotspot opens / audio plays per release), each gated to
  the tier that unlocks it
- Lyrics/liner-note import: upload a `.txt`/`.pdf`/`.docx` in the editor and it's queued
  for text extraction, then dropped into an editable text block
- Server-rendered export: high-res PDF, a self-contained interactive web-viewer bundle
  (.zip), and a per-page image set (.zip) — all run as background jobs so a slow render
  never blocks the request
- **Standard web export** (product spec's tier matrix, distinct from the zip bundle above):
  a hosted, shareable `/p/[slug]` link, free on every tier including Free — the "Share"
  button in the editor toggles it on/off. No account needed to view it.
- Image/audio uploads go to a presigned S3 URL instead of being inlined as base64
- Free-tier project limit enforced **server-side** (not just in the UI)
- Stripe Checkout session creation + webhook that flips an org's tier on payment
- Append-only audit log covering project create/delete, member add/role-change/remove,
  tier changes, and SSO configuration
- Password reset (forgot-password email → token → new password), rate-limited and
  enumeration-safe (same response whether or not the email exists)
- Stripe Billing Portal ("Billing" button on the dashboard) — self-serve cancel/update
  card, backed by a real Stripe Customer created at first checkout
- Rate limiting (Redis-backed) on signup, login, password reset, and public analytics
  ingestion
- Security headers (`next.config.js`), a real landing page, Terms/Privacy pages (templates
  — see below), `/api/health`, structured error logging, and CI (typecheck + build on
  every push/PR)

**Stubbed / needs your keys:**
- Asset uploads need real AWS/S3 credentials in `.env` — without them, `POST /api/assets/upload-url`
  will fail at the S3 call. There's a dev-only tier-switch route (`/api/dev/set-tier`, blocked in
  production) so you can test upgrade-gated features without live Stripe keys.
- Document parsing and server-rendered export both run in the worker process
  (`npm run worker`) against Redis — nothing happens until that process is running
  alongside `next dev`/`next start`.
- The PDF/image renderer uses `puppeteer`'s bundled Chromium. If your deployment target
  blocks that download (locked-down CI, some serverless platforms), swap
  `lib/export/pdf.ts` and `lib/export/images.ts` for `puppeteer-core` +
  `@sparticuz/chromium` instead.
- Password reset emails need `RESEND_API_KEY` (or swap `lib/email.ts` for another
  provider) — without it, reset links are logged to the console instead of emailed. Fine
  for local dev, not for production.
- `/terms` and `/privacy` are explicitly-marked **templates** with bracketed placeholders —
  have them reviewed before relying on them, especially for EU/UK/California users.
- Error monitoring is a lightweight structured-console-log abstraction
  (`lib/monitoring.ts`), not the full Sentry SDK — see the comment in that file for why,
  and the exact upgrade path.
- SSO needs a real OIDC identity provider (Okta, Azure AD, Google Workspace, etc.) — an
  Enterprise-tier org admin configures it under Team → SSO Settings.

## Setup

```bash
npm install
docker compose up -d              # local Postgres on :5432, Redis on :6379
cp .env.example .env               # fill in NEXTAUTH_SECRET and SSO_ENCRYPTION_KEY at minimum
npx prisma migrate dev --name init
npm run dev                        # in one terminal
npm run worker                     # in another — required for lyric import & exports
```

Open `http://localhost:3000/signup`, create an account, and you land in `/app` — the full
studio. Your first booklet is free; try creating a second project to see the upgrade modal,
or click a locked theme in the Theme panel.

`NEXTAUTH_SECRET` and `SSO_ENCRYPTION_KEY` can each be any random 32-byte string for local
dev (`openssl rand -base64 32`). `DATABASE_URL` and `REDIS_URL` in `.env.example` already
match the docker-compose services.

Image/audio upload and self-serve billing need real AWS and Stripe credentials respectively —
without them those two specific actions will error, but everything else in the app works
against your local Postgres. Document parsing and export additionally need the worker
process running (see above); SSO additionally needs a real identity provider configured
per-org.

## Project layout

```
app/login, app/signup          Auth pages (app/login/sso for the SSO entry point)
app/app/page.tsx                Protected mount point → components/BookletApp.tsx
components/BookletApp.tsx       The entire studio UI: dashboard, editor, theme designer,
                                 layers, pages, preview — all calling lib/api-client.ts
components/OrgWorkspace.tsx     Team workspace: roster/roles, audit log, analytics, SSO settings
lib/api-client.ts               Typed fetch wrapper the UI uses instead of window.storage
lib/types.ts                    Shared Project/Page/Block/Org types (client + reference)
lib/db.ts, lib/auth.ts          Prisma singleton, NextAuth config
lib/entitlements.ts             Tier → feature/limit lookups
lib/storage.ts                  S3 presigned upload URL generator + direct server upload/download
lib/queue.ts                    BullMQ/Redis queue definitions shared by API routes + worker
lib/audit.ts                    Append-only audit log helper
lib/analytics.ts                Event ingestion + per-org aggregation for the analytics dashboard
lib/parsing.ts                  DOCX/PDF/TXT text extraction (used by the worker)
lib/export/                     Shared HTML renderer + PDF / image / web-bundle export builders
lib/sso.ts, lib/crypto.ts       OIDC (PKCE) client + NextAuth-compatible session minting,
                                 AES-256-GCM encryption for stored client secrets
worker/                         Standalone process (`npm run worker`) consuming the
                                 document-parse and export queues — never runs inline in a request
app/api/...                     All routes from the original backend scaffold, plus:
  auth/signup                    Creates a user + their personal org
  orgs                           List/create orgs (+ [orgId]/members, /audit-log, /analytics, /sso)
  assets                         Persist an Asset row after a direct-to-S3 upload
  projects/[id]/parse-jobs       Enqueue/poll lyric-import text extraction
  projects/[id]/export-jobs      Enqueue/poll a PDF / web-bundle / image export
  analytics/track                Public event ingestion (Preview Viewer + exported web bundles)
  sso/[slug]/login, /callback     OIDC authorization-code + PKCE flow for Enterprise SSO
  dev/set-tier                   Dev-only tier switch (blocked outside development)
middleware.ts                   Gates /app/* behind a signed-in session
docker-compose.yml               Local Postgres + Redis for development
```

## Tier gating pattern

`lib/entitlements.ts` is the single source of truth for what each tier unlocks. Every
gated route does the same two checks:

1. `canCreateProject(org.tier, currentCount)` — `POST /api/projects`
2. `hasFeature(org.tier, "roles" | "audit_log" | "analytics" | "sso" | "hq_export" | "embed_export" | "social_export" | ...)` — org/project-level routes

Gated responses return HTTP 402 with `{ error, code: "TIER_LIMIT" }`, which
`lib/api-client.ts`'s `ApiError` surfaces with a `.code` property — the UI catches that
specific code to show the upgrade modal rather than a generic error toast.

## What's next

Everything in the original "What's next" list now has a working implementation — Label/
Enterprise screens, document parsing, server-rendered export, analytics ingestion, and SSO.
Remaining polish, roughly in priority order:

- **SSO** currently supports OIDC only (no SAML) and provisions one default role per org
  on first sign-in — per-IdP-group role mapping would be the next step for larger Enterprise
  customers
- **Export job UI** is poll-based (2s interval, 2min timeout) rather than websocket-pushed;
  fine at current volume, worth revisiting if export jobs start queueing up
- **Analytics** is unsampled and unbounded — add retention/rollup once event volume justifies it
- **Worker deployment** — `worker/index.ts` is a single process with fixed concurrency
  (4 for parsing, 2 for export, since headless Chromium is memory-hungry); horizontal
  scaling just means running more worker instances against the same Redis, no code changes
  needed
- **Legacy `.doc` files** (pre-2007 binary Word format) aren't supported for lyric import —
  `lib/parsing.ts` returns a friendly error asking for `.docx`/`.pdf`/`.txt` instead
- **No automated tests yet.** `lib/entitlements.ts` (the tier-gating logic that directly
  protects revenue) is the highest-value place to start.
- **No account/org self-service deletion** — no GDPR "right to be forgotten" flow yet.
  `/privacy` calls this out as an open item rather than promising something that isn't built.
- **No strict Content-Security-Policy** — the other security headers are in
  `next.config.js`, but a real CSP needs nonce wiring through the App Router's hydration
  scripts, which wasn't done blind without a way to verify it doesn't break the build.

## Type-checking

```bash
npm run typecheck
```

Note: `prisma generate` downloads its query-engine binary from `binaries.prisma.sh`. If
you're behind a restrictive proxy/allowlist, that domain needs to be reachable — Prisma
Client's generated types are required for this to type-check clean. `puppeteer` similarly
downloads a Chromium binary on `npm install`; set `PUPPETEER_SKIP_DOWNLOAD=1` if you only
need to typecheck/build without running the worker locally.

