import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { parseBody, ssoConfigSchema } from "@/lib/validation";

async function requireEnterpriseAdmin(userId: string, orgId: string) {
  const org = await db.org.findUnique({ where: { id: orgId } });
  if (!org) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!hasFeature(org.tier, "sso")) {
    return { error: NextResponse.json({ error: "SSO requires the Enterprise Label tier", code: "TIER_LIMIT" }, { status: 402 }) };
  }
  const membership = await db.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  if (!membership || membership.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { org };
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireEnterpriseAdmin(session.user.id, params.orgId);
  if (access.error) return access.error;

  const config = await db.ssoConfig.findUnique({ where: { orgId: params.orgId } });
  if (!config) return NextResponse.json({ config: null, loginUrl: null });

  const org = await db.org.findUnique({ where: { id: params.orgId } });
  return NextResponse.json({
    config: { issuer: config.issuer, clientId: config.clientId, defaultRole: config.defaultRole, hasClientSecret: true as const },
    loginUrl: org?.slug ? `/login/sso/${org.slug}` : null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireEnterpriseAdmin(session.user.id, params.orgId);
  if (access.error) return access.error;

  const parsed = await parseBody(req, ssoConfigSchema);
  if ("error" in parsed) return parsed.error;
  const { issuer, clientId, clientSecret, defaultRole } = parsed.data;

  const existing = await db.ssoConfig.findUnique({ where: { orgId: params.orgId } });
  if (!existing && !clientSecret) {
    return NextResponse.json({ error: "clientSecret is required when first enabling SSO" }, { status: 400 });
  }
  // Blank clientSecret on an update means "keep the current one" (the UI labels it that
  // way) — only re-encrypt when a new value was actually provided.
  const clientSecretEncrypted = clientSecret ? encryptSecret(clientSecret) : existing!.clientSecretEncrypted;

  const config = await db.ssoConfig.upsert({
    where: { orgId: params.orgId },
    update: { issuer, clientId, clientSecretEncrypted, defaultRole: defaultRole || "VIEWER" },
    create: { orgId: params.orgId, issuer, clientId, clientSecretEncrypted, defaultRole: defaultRole || "VIEWER" },
  });

  await db.org.update({ where: { id: params.orgId }, data: { ssoEnabled: true } });
  await logAudit({ orgId: params.orgId, actorId: session.user.id, action: "org.sso_configured", meta: { issuer, clientId } });

  return NextResponse.json({ config: { issuer: config.issuer, clientId: config.clientId, defaultRole: config.defaultRole, hasClientSecret: true as const } });
}

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireEnterpriseAdmin(session.user.id, params.orgId);
  if (access.error) return access.error;

  await db.ssoConfig.deleteMany({ where: { orgId: params.orgId } });
  await db.org.update({ where: { id: params.orgId }, data: { ssoEnabled: false } });
  await logAudit({ orgId: params.orgId, actorId: session.user.id, action: "org.sso_removed" });

  return NextResponse.json({ ok: true });
}
