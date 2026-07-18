import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

async function assertAccess(userId: string, projectId: string, allowedRoles: Role[]) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return { errorResponse: NextResponse.json({ error: "Not found" }, { status: 404 }), project: null };
  }

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  });
  if (!membership || !allowedRoles.includes(membership.role)) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }), project: null };
  }

  return { errorResponse: null, project, membership };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertAccess(session.user.id, params.id, ["ADMIN", "DESIGNER", "COLLABORATOR"]);
  if (access.errorResponse) return access.errorResponse;

  const body = await req.json();
  const allowedKeys = ["name", "order", "blocks"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) data[key] = body[key];
  }

  const page = await db.page.update({ where: { id: params.pageId }, data });
  return NextResponse.json({ page });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertAccess(session.user.id, params.id, ["ADMIN", "DESIGNER"]);
  if (access.errorResponse) return access.errorResponse;

  await db.page.delete({ where: { id: params.pageId } });
  return NextResponse.json({ ok: true });
}
