import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id }, include: { pages: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const page = await db.page.create({
    data: {
      projectId: project.id,
      name: body.name || "New page",
      order: project.pages.length,
      blocks: body.blocks ?? [],
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
