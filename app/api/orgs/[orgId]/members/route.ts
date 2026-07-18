import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import type { Role } from "@prisma/client";

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

  const { email, role } = (await req.json()) as { email?: string; role?: Role };
  if (!email || !role) return NextResponse.json({ error: "email and role are required" }, { status: 400 });

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email } });
  }

  const membership = await db.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: params.orgId } },
    update: { role },
    create: { userId: user.id, orgId: params.orgId, role },
  });

  return NextResponse.json({ membership }, { status: 201 });
}
