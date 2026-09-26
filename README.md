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
- Account self-deletion (Account settings, from the dashboard header) and org deletion
  (Team → danger zone) — with a real safety check: you can't delete your account while
  you're the sole admin of an org that has other members
- Security headers including a baseline CSP (`next.config.js`), a real landing page,
  Terms/Privacy pages (templates — see below), `/api/health`, structured error logging,
  and CI (typecheck + tests + build on every push/PR)

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

## Known security exceptions

**Fixed, but worth understanding:** `PATCH /api/projects/[id]/pages/[pageId]` and
`PATCH /api/projects/[id]` both store `blocks`/`theme` as opaque JSON straight from the
request body — neither validates its shape against a schema (see the `allowedKeys`
passthrough in each route). Combined with `/p/[slug]` serving `lib/export/render-html.ts`'s
output as unescaped `text/html` to unauthenticated public visitors, an unvalidated field
like a block's `color` or a theme's `bg` reaching that renderer unescaped would have been
a real stored-XSS path — not hypothetical, exploitable by any COLLABORATOR-role member,
against anyone who opens that project's public link. **The renderer itself is now hardened**
(every interpolated field is escaped or numerically coerced regardless of its declared
type, proven by `tests/render-html-security.test.ts` actually injecting payloads and
asserting they don't survive) — but the two API routes above still accept unvalidated
JSON for `blocks`/`theme`. That's defense-in-depth working as intended (the layer that
actually mattered, the one serving raw HTML to the public, is fixed), not a reason to
skip adding real schema validation at the API layer too — it's still the more correct fix,
just a larger one (the block union type is non-trivial to express fully in zod), and
worth doing as a follow-up rather than trusting the renderer to be the only safety net
forever.

**Next.js is intentionally pinned at 14.2.35, not upgraded to 16.x, despite two open advisories**
(1 critical, 1 high — see `npm audit`; GitHub's Dependabot PR #1 on this repo proposes the
same bump). This is a deliberate decision, not an oversight:

- Neither advisory has a fix backported into the 14.x line — 14.2.35 is already the latest
  patch release of the major version this app is built on.
- `next-auth` v4 (used throughout this app — see `lib/auth.ts`, `middleware.ts`, and every
  route calling `getServerSession`) has well-documented incompatibilities with Next.js 15+,
  which moved `cookies()`/`headers()` to async APIs that v4's session handling predates.
  A real fix means migrating to Auth.js v5 across roughly 21 files, which is a genuine
  rewrite, not a version bump.
- That migration needs to be done as its own dedicated effort with real end-to-end testing
  (a live Postgres, actual login flows exercised) — not force-pushed on the assumption it
  works, since getting it wrong breaks authentication for the entire app.

**If you want to pick this up:** close or ignore Dependabot PR #1 as-is (merging it alone
will break `next-auth`), and instead track "Next 16 + Auth.js v5 migration" as one deliberate
piece of work. `Dockerfile`, the CI workflow, and `package.json`'s `engines` field are already
on Node ≥22.12 (required by the Puppeteer bump below), so that part of the groundwork is done.

**`puppeteer` was bumped 22→25** (fixed 4 of 6 `npm audit` findings — the `extract-zip`/
`@puppeteer/browsers` chain) since this app only touches Puppeteer's most stable API surface
(`launch`, `setViewport`, `setContent`, `page.pdf`, `elementHandle.screenshot`), which hasn't
had breaking changes across these majors. `Dockerfile.worker`'s base image was bumped to match.

**Content-Security-Policy is a "baseline," not a strict one** (`next.config.js`). Both
`script-src` and `style-src` include `'unsafe-inline'` — deliberate compromises, not
oversights. Next.js's App Router injects inline `<script>` tags for hydration/RSC data as
a fundamental part of how it works, and this codebase uses inline `style={{}}` React props
extensively; eliminating either requires either full nonce-wiring through `middleware.ts`
(which also handles auth-gating — risky to touch blind) or a full CSS-modules refactor,
neither of which belongs in a security-headers pass. What this CSP still does block: any
script/style/frame loading from an untrusted *external* origin, `<object>`/`<embed>`-based
exploits, and `form-action`/`base-uri` hijacking.

## What's next

Everything in the original "What's next" list now has a working implementation — Label/
Enterprise screens, document parsing, server-rendered export, analytics ingestion, and SSO.
Remaining polish, roughly in priority order:

- **SSO** currently supports OIDC only (no SAML) and provisions one default role per org
  on first sign-in — per-IdP-group role mapping would be the next step for larger Enterprise
  customers
- **No upload size limit anywhere in the pipeline** — presigned PUT URLs
  (`lib/storage.ts`'s `createUploadUrl`) don't cap size the way presigned POST policies
  can, and there's no client- or server-side check either. `downloadObject` now refuses
  anything over 25MB (protects the worker from an OOM crash on a huge lyric-import file —
  see `lib/storage.ts`), but that's a narrow fix for the one place a giant file could
  crash a process; images/audio can still be uploaded at any size, which is a cost and
  abuse-surface concern worth a real fix (switching to presigned POST with a
  `content-length-range` condition, or a client-side pre-check) if this goes further.
- **Export job UI** is poll-based (2s interval, 2min timeout) rather than websocket-pushed;
  fine at current volume, worth revisiting if export jobs start queueing up
- **Analytics** is unsampled and unbounded — add retention/rollup once event volume justifies it
- **Worker deployment** — `worker/index.ts` is a single process with fixed concurrency
  (4 for parsing, 2 for export, since headless Chromium is memory-hungry); horizontal
  scaling just means running more worker instances against the same Redis, no code changes
  needed
- **Legacy `.doc` files** (pre-2007 binary Word format) aren't supported for lyric import —
  `lib/parsing.ts` returns a friendly error asking for `.docx`/`.pdf`/`.txt` instead

## Tests

```bash
npm run test
```

28 tests covering the modules that are pure enough to unit test without a live database:
`lib/entitlements.ts` (tier-gating — the highest-value target, since it's what directly
protects revenue), `lib/validation.ts` (every zod schema guarding a mutating/public route,
including the one unauthenticated endpoint in the app), and `lib/parsing.ts`'s mime-type
detection. Runs in CI on every push/PR. Everything with a real Postgres/S3/Redis
dependency (API routes, the worker, SSO) still needs the manual smoke test in
`docs/deployment.md` — that's the next place to extend coverage, likely with a test
database and `supertest`-style route tests, if this grows further.

## Type-checking

```bash
npm run typecheck
```

Note: `prisma generate` downloads its query-engine binary from `binaries.prisma.sh`. If
you're behind a restrictive proxy/allowlist, that domain needs to be reachable — Prisma
Client's generated types are required for this to type-check clean. `puppeteer` similarly
downloads a Chromium binary on `npm install`; set `PUPPETEER_SKIP_DOWNLOAD=1` if you only
need to typecheck/build without running the worker locally.

