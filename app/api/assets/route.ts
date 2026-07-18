import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, key, url, type, sizeBytes } = (await req.json()) as {
    orgId?: string;
    key?: string;
    url?: string;
    type?: string;
    sizeBytes?: number;
  };
  if (!orgId || !key || !url || !type || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "orgId, key, url, type, and sizeBytes are required" }, { status: 400 });
  }

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await db.asset.create({ data: { orgId, key, url, type, sizeBytes } });
  return NextResponse.json({ asset }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assets = await db.asset.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ assets });
}
