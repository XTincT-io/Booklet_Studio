import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/entitlements";
import { getExportQueue } from "@/lib/queue";
import { parseBody, exportJobSchema } from "@/lib/validation";
import type { ExportType } from "@prisma/client";

// PDF is available on every tier (Free gets "one basic PDF/image export"; resolution is
// upgraded server-side for hq_export tiers). Web bundle and image-set exports are gated
// behind their tier features per the feature matrix (product spec §11).
const EXPORT_TYPE_FEATURE: Record<ExportType, string | null> = {
  PDF: null,
  WEB_BUNDLE: "embed_export",
  IMAGES: "social_export",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [membership, org] = await Promise.all([
    db.membership.findUnique({ where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } } }),
    db.org.findUnique({ where: { id: project.orgId } }),
  ]);
  if (!membership || !org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseBody(req, exportJobSchema);
  if ("error" in parsed) return parsed.error;
  const { type } = parsed.data;

  const requiredFeature = EXPORT_TYPE_FEATURE[type];
  if (requiredFeature && !hasFeature(org.tier, requiredFeature)) {
    return NextResponse.json(
      { error: `${type === "WEB_BUNDLE" ? "Embeddable web-viewer" : "Image asset"} export requires Indie Artist or higher`, code: "TIER_LIMIT" },
      { status: 402 }
    );
  }

  const jobRow = await db.exportJob.create({
    data: { orgId: project.orgId, projectId: project.id, requestedBy: session.user.id, type, status: "QUEUED" },
  });

  await getExportQueue().add("export", { jobRowId: jobRow.id });

  return NextResponse.json({ job: { id: jobRow.id, type: jobRow.type, status: jobRow.status } }, { status: 201 });
}
