import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * ANALYTICS INGESTION ROUTE
 * Records public engagement events (page views, hotspot clicks).
 * Note: This route is unauthenticated to allow tracking for public booklets.
 */
export async function POST(req: NextRequest) {
  try {
    const { projectId, pageId, type } = (await req.json()) as {
      projectId: string;
      pageId?: string;
      type: string;
    };

    if (!projectId || !type) {
      return NextResponse.json({ error: "projectId and type are required" }, { status: 400 });
    }

    const event = await db.analyticsEvent.create({
      data: {
        projectId,
        pageId,
        type,
      },
    });

    return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
  } catch (error) {
    console.error("Analytics ingestion error:", error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
