import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { org: true },
  });

  const orgs = memberships.map((m) => ({ id: m.org.id, name: m.org.name, tier: m.org.tier, role: m.role }));
  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = (await req.json()) as { name?: string };
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const org = await db.org.create({
    data: {
      name,
      tier: "FREE",
      memberships: { create: { userId: session.user.id, role: "ADMIN" } },
    },
  });

  return NextResponse.json({ org: { id: org.id, name: org.name, tier: org.tier, role: "ADMIN" } }, { status: 201 });
}
