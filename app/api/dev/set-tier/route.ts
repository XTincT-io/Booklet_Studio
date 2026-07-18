import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";

/**
 * DEV-ONLY. Lets you flip an org's tier locally while building, without wiring up
 * real Stripe test-mode checkout. Blocked outside development. Delete this route
 * (or leave the guard in place) before deploying to production.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, tier } = (await req.json()) as { orgId?: string; tier?: Tier };
  if (!orgId || !tier) return NextResponse.json({ error: "orgId and tier are required" }, { status: 400 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await db.org.update({ where: { id: orgId }, data: { tier } });
  return NextResponse.json({ org });
}
