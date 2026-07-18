import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireMembership(userId: string, orgId: string) {
  return db.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { pages: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await requireMembership(session.user.id, project.orgId);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await requireMembership(session.user.id, project.orgId);
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowedKeys = ["name", "artist", "metadata", "theme", "status", "releaseDate"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) data[key] = body[key];
  }

  const updated = await db.project.update({ where: { id: params.id }, data });
  return NextResponse.json({ project: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await requireMembership(session.user.id, project.orgId);
  if (!membership || !["ADMIN", "DESIGNER"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
