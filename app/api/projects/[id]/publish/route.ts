import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniqueProjectSlug } from "@/lib/project-slug";
import { parseBody } from "@/lib/validation";
import { z } from "zod";
import { appUrl } from "@/lib/sso";

const schema = z.object({ enabled: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  // The slug is generated once and kept stable across publish/unpublish/republish
  // cycles — an artist who shared a link shouldn't have it silently break because they
  // unpublished and republished later.
  const publicSlug = project.publicSlug ?? (parsed.data.enabled ? await generateUniqueProjectSlug() : null);

  const updated = await db.project.update({
    where: { id: params.id },
    data: { publicEnabled: parsed.data.enabled, publicSlug },
  });

  return NextResponse.json({
    publicEnabled: updated.publicEnabled,
    publicUrl: updated.publicEnabled && updated.publicSlug ? `${appUrl()}/p/${updated.publicSlug}` : null,
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    publicEnabled: project.publicEnabled,
    publicUrl: project.publicEnabled && project.publicSlug ? `${appUrl()}/p/${project.publicSlug}` : null,
  });
}
