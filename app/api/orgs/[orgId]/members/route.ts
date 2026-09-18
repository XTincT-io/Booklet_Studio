import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import { logAudit } from "@/lib/audit";
import { parseBody, addMemberSchema, removeMemberSchema } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: params.orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await db.membership.findMany({
    where: { orgId: params.orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.org.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasFeature(org.tier, "roles")) {
    return NextResponse.json(
      { error: "Roster and role management requires Indie Label or higher", code: "TIER_LIMIT" },
      { status: 402 }
    );
  }

  const requesterMembership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: params.orgId } },
  });
  if (!requesterMembership || requesterMembership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, addMemberSchema);
  if ("error" in parsed) return parsed.error;
  const { email, role } = parsed.data;

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email } });
  }

  const existing = await db.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: params.orgId } } });

  const membership = await db.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: params.orgId } },
    update: { role },
    create: { userId: user.id, orgId: params.orgId, role },
  });

  await logAudit({
    orgId: params.orgId,
    actorId: session.user.id,
    action: existing ? "member.role_changed" : "member.added",
    targetId: user.id,
    meta: { email, role, previousRole: existing?.role },
  });

  return NextResponse.json({ membership }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requesterMembership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: params.orgId } },
  });
  if (!requesterMembership || requesterMembership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, removeMemberSchema);
  if ("error" in parsed) return parsed.error;
  const { membershipId } = parsed.data;

  const target = await db.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.orgId !== params.orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "You can't remove your own membership." }, { status: 400 });
  }

  await db.membership.delete({ where: { id: membershipId } });

  await logAudit({ orgId: params.orgId, actorId: session.user.id, action: "member.removed", targetId: target.userId });

  return NextResponse.json({ ok: true });
}
