import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadProjectFull } from "@/lib/project-full";
import { renderWebViewerHtml } from "@/lib/export/render-html";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * The "Standard web export" from the product spec's tier matrix — a hosted, shareable
 * link available on every tier including Free (distinct from the downloadable
 * "Embeddable web viewer" .zip bundle, which is Indie Artist+ — see
 * app/api/projects/[id]/export-jobs/route.ts). Reuses the exact same renderer as that
 * bundle (lib/export/render-html.ts) so both surfaces stay visually identical; this one
 * just serves the HTML directly instead of zipping it for download.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`public-viewer:${ip}`, 120, 60);
  if (!allowed) return new NextResponse("Too many requests", { status: 429 });

  const project = await db.project.findUnique({ where: { publicSlug: params.slug } });
  if (!project || !project.publicEnabled) {
    return new NextResponse("This link isn't active. It may have been unpublished by its owner.", { status: 404 });
  }

  const full = await loadProjectFull(project.id);
  if (!full) return new NextResponse("Not found", { status: 404 });

  const html = renderWebViewerHtml(full);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
