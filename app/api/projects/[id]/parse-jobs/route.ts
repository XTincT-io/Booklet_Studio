import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDocumentParseQueue } from "@/lib/queue";
import { parseBody, parseJobSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseBody(req, parseJobSchema);
  if ("error" in parsed) return parsed.error;
  const { key, filename, mimeType } = parsed.data;

  const jobRow = await db.documentParseJob.create({
    data: {
      orgId: project.orgId,
      projectId: project.id,
      requestedBy: session.user.id,
      assetKey: key,
      filename,
      mimeType,
      status: "QUEUED",
    },
  });

  await getDocumentParseQueue().add("parse", { jobRowId: jobRow.id });

  return NextResponse.json({ job: { id: jobRow.id, status: jobRow.status } }, { status: 201 });
}
