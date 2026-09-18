import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { parseBody, trackEventSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Deliberately unauthenticated: this is called from the Preview Viewer (which org
 * members already have access to) and from the exported static web-viewer bundle
 * (which fans/listeners with no Booklet Studio account view). We only ever write one of
 * three known event types against a project id that must already exist — no arbitrary
 * data, no PII. Being public and unauthenticated, this is the most exposed route in the
 * app, so it validates strictly, rate-limits per IP, and never leaks internal errors
 * from a malformed body.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`analytics-track:${ip}`, 120, 60); // generous — real listeners flip pages/hotspots quickly
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = await parseBody(req, trackEventSchema);
  if ("error" in parsed) return parsed.error;
  const { projectId, pageId, type } = parsed.data;

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await trackEvent({ projectId, pageId, type });
  return NextResponse.json({ ok: true }, { status: 201 });
}
