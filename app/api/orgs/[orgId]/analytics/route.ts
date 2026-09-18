import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import { getOrgAnalyticsSummary } from "@/lib/analytics";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.org.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasFeature(org.tier, "analytics")) {
    return NextResponse.json({ error: "Analytics requires the Indie Label tier or higher", code: "TIER_LIMIT" }, { status: 402 });
  }

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: params.orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const summary = await getOrgAnalyticsSummary(params.orgId);
  return NextResponse.json({ projects: summary });
}
