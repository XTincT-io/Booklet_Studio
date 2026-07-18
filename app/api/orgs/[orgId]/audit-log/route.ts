import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.org.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasFeature(org.tier, "audit_log")) {
    return NextResponse.json(
      { error: "Audit logs require the Enterprise Label tier", code: "TIER_LIMIT" },
      { status: 402 }
    );
  }

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: params.orgId } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await db.auditLog.findMany({
    where: { orgId: params.orgId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ logs });
}
