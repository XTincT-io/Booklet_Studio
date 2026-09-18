# Deploying Booklet Studio

Booklet Studio is **two separate deployable processes**, not one:

1. **Web app** (`next start` / `Dockerfile`) — stateless, handles all HTTP/API traffic.
2. **Worker** (`npm run worker` / `Dockerfile.worker`) — long-running, consumes the
   document-parse and export BullMQ queues (headless-Chromium rendering, DOCX/PDF/TXT
   text extraction).

**This split matters for hosting.** The web app is a normal Next.js app and runs fine on
Vercel or any Node host. The worker is a long-running process holding a persistent Redis
connection and spawning headless Chromium — that does **not** run on Vercel, Netlify, or
similar serverless/edge platforms, which kill processes between requests. Deploy the
worker to something that keeps a process alive: Railway, Fly.io, Render (background
worker service), AWS ECS/Fargate, or a plain VM with a process manager. `Dockerfile.worker`
targets exactly that kind of host.

## Architecture at a glance

```
                     ┌─────────────┐
   browser ───────── │   Web app   │ ──────► Postgres (projects, users, jobs, audit log)
                      │ (stateless) │ ──────► S3 (images/audio/exports)
                      └──────┬──────┘
                             │ enqueues jobs
                             ▼
                        ┌────────┐
                        │ Redis  │◄──────────┐
                        └────────┘            │
                             │ consumes jobs   │
                             ▼                 │
                      ┌─────────────┐          │
                      │   Worker    │ ─────────┘ (writes job results back to Postgres,
                      │ (long-lived)│             uploads rendered files to S3)
                      └─────────────┘
```

## Managed service choices (pick one per row)

| Need | Options |
|---|---|
| Postgres | Neon, Supabase, Railway Postgres, RDS |
| Redis | Upstash, Railway Redis, ElastiCache |
| Object storage | S3 directly, or an S3-compatible service (R2, Backblaze B2) — anything `@aws-sdk/client-s3` can talk to |
| Web app host | Vercel, Railway, Fly.io, Render, or `Dockerfile` anywhere |
| Worker host | Railway, Fly.io, Render (background worker), ECS/Fargate, or a VM — **not** Vercel/Netlify |

## First-deploy checklist

1. **Provision Postgres, Redis, and an S3 bucket.**

2. **Configure S3 CORS** so the browser can upload directly via presigned URLs:
   ```bash
   aws s3api put-bucket-cors --bucket YOUR_BUCKET --cors-configuration file://infra/s3-cors-policy.json
   ```
   Edit `infra/s3-cors-policy.json` first — replace the placeholder origin with your real
   production domain (and keep `localhost:3000` for local dev). Without this, every
   image/audio upload will fail with a browser CORS error even though the presigned URL
   itself is valid.

3. **Set every variable in `.env.example`** on both the web app and worker hosts. The
   worker specifically needs `DATABASE_URL`, `REDIS_URL`, and the `AWS_*`/`ASSET_*`
   vars — it talks to Postgres and S3 directly, independent of the web app.

4. **Generate and commit your first migration**, then apply it:
   ```bash
   npx prisma migrate dev --name init      # run once, locally, against a real Postgres
   git add prisma/migrations && git commit -m "Add initial migration"
   ```
   This repo intentionally has no `prisma/migrations/` committed yet — `schema.prisma`
   is the source of truth and the first migration should be generated against your own
   database rather than hand-written. From then on, deploy with:
   ```bash
   npx prisma migrate deploy               # safe for CI/CD — applies pending migrations, no prompts
   ```
   Run `migrate deploy` as a pre-deploy step (most platforms support a "release command" /
   "pre-deploy hook" for exactly this) rather than `migrate dev`, which can prompt
   interactively and isn't meant for production.

5. **Build and deploy the web app.** If using the provided `Dockerfile`:
   ```bash
   docker build -t booklet-studio-web .
   docker run -p 3000:3000 --env-file .env booklet-studio-web
   ```
   On Vercel: it auto-detects Next.js, just set the environment variables and deploy —
   `output: "standalone"` in `next.config.js` doesn't interfere with Vercel's own build.

6. **Build and deploy the worker**, as a separate service:
   ```bash
   docker build -f Dockerfile.worker -t booklet-studio-worker .
   docker run --env-file .env booklet-studio-worker
   ```

7. **Point your uptime monitor / load balancer health check at `/api/health`.** It checks
   Postgres connectivity and returns 503 if the database is unreachable. It deliberately
   does *not* check Redis — a Redis blip shouldn't flip the whole web app's health check
   (lyric import / export just temporarily can't enqueue; everything else keeps working).
   Monitor the worker separately via Redis queue depth / stalled-job count, since it has
   no HTTP endpoint of its own to poll.

8. **Configure Stripe webhooks** to point at `https://your-domain/api/billing/webhook`
   with the signing secret in `STRIPE_WEBHOOK_SECRET`.

9. **Smoke test**: sign up, create a project, upload an image, run a lyric import, run
   each of the three export types, and confirm an audit-log entry appears for an Enterprise
   org. That exercises Postgres, S3, and both queues end to end.

## Scaling the worker

`worker/index.ts` is a single process with fixed concurrency (4 for document parsing, 2
for export — headless Chromium is memory-hungry, hence the lower number). To scale,
run more instances of the same worker image pointed at the same Redis — BullMQ handles
distributing jobs across them with no code changes.

## Known constraints worth knowing about before you deploy

- **Puppeteer's Chromium download.** `Dockerfile.worker` uses Puppeteer's own base image
  (which already bundles Chromium) specifically to sidestep this. If you deploy the
  worker a different way, make sure whatever environment builds it can actually reach
  Puppeteer's Chromium download, or switch `lib/export/pdf.ts` / `lib/export/images.ts`
  to `puppeteer-core` + `@sparticuz/chromium` for locked-down/serverless-style build
  environments.
- **SSO is OIDC only** (no SAML) — see `lib/sso.ts` for why (NextAuth v4 can't register
  per-tenant dynamic providers, so this is a hand-rolled PKCE flow instead).
- **`SSO_ENCRYPTION_KEY` is a single app-wide key.** Losing it means every org's stored
  SSO client secret becomes unreadable — back it up like you would `NEXTAUTH_SECRET`.
