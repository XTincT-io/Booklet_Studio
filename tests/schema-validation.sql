-- Hand-transcribed from prisma/schema.prisma to validate structure against a real
-- Postgres, since the Prisma engine binary is unreachable in the sandbox this was
-- originally written in. NOT a substitute for `npx prisma migrate dev` — Prisma's real
-- migration should still be generated against your own database. This exists purely to
-- catch typos/invalid syntax/contradictory constraints before that point, and has
-- itself been verified: applied successfully against a real Postgres 16 instance with
-- zero errors (see docs/deployment.md's "What's actually been verified" section).
-- Safe to re-run for a quick sanity check: `psql $DATABASE_URL -f tests/schema-validation.sql`
-- against a scratch/empty database.

CREATE TYPE "Role" AS ENUM ('ADMIN', 'DESIGNER', 'COLLABORATOR', 'VIEWER');
CREATE TYPE "Tier" AS ENUM ('FREE', 'INDIE_ARTIST', 'INDIE_LABEL', 'ENTERPRISE');
CREATE TYPE "ReleaseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'FINAL', 'LIVE');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');
CREATE TYPE "ExportType" AS ENUM ('PDF', 'WEB_BUNDLE', 'IMAGES');
CREATE TYPE "SsoProviderKind" AS ENUM ('OIDC');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT UNIQUE NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

CREATE TABLE "Org" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE,
  "tier" "Tier" NOT NULL DEFAULT 'FREE',
  "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE "Membership" (
  "id" TEXT PRIMARY KEY,
  "role" "Role" NOT NULL DEFAULT 'VIEWER',
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  UNIQUE ("userId", "orgId")
);

CREATE TABLE "Project" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "artist" TEXT,
  "formatId" TEXT NOT NULL,
  "status" "ReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "releaseDate" TIMESTAMP(3),
  "metadata" JSONB NOT NULL,
  "theme" JSONB NOT NULL,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publicSlug" TEXT UNIQUE,
  "publicEnabled" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

CREATE TABLE "Page" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "blocks" JSONB NOT NULL,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE
);
CREATE INDEX "Page_projectId_idx" ON "Page"("projectId");

CREATE TABLE "Asset" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Asset_orgId_idx" ON "Asset"("orgId");

CREATE TABLE "ThemePreset" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE
);
CREATE INDEX "ThemePreset_orgId_idx" ON "ThemePreset"("orgId");

CREATE TABLE "Comment" (
  "id" TEXT PRIMARY KEY,
  "body" TEXT NOT NULL,
  "pageId" TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetId" TEXT,
  "meta" JSONB,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "AuditLog_orgId_idx" ON "AuditLog"("orgId");

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "pageId" TEXT,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "AnalyticsEvent_projectId_idx" ON "AnalyticsEvent"("projectId");
CREATE INDEX "AnalyticsEvent_projectId_type_createdAt_idx" ON "AnalyticsEvent"("projectId", "type", "createdAt");

CREATE TABLE "DocumentParseJob" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "assetKey" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "resultText" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "DocumentParseJob_orgId_idx" ON "DocumentParseJob"("orgId");
CREATE INDEX "DocumentParseJob_projectId_idx" ON "DocumentParseJob"("projectId");

CREATE TABLE "ExportJob" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "type" "ExportType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "resultUrl" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ExportJob_orgId_idx" ON "ExportJob"("orgId");
CREATE INDEX "ExportJob_projectId_idx" ON "ExportJob"("projectId");

CREATE TABLE "SsoConfig" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT UNIQUE NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "provider" "SsoProviderKind" NOT NULL DEFAULT 'OIDC',
  "issuer" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecretEncrypted" TEXT NOT NULL,
  "defaultRole" "Role" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
