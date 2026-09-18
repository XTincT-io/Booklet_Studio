import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Liveness + readiness check for load balancers, uptime monitors, and deploy platforms
 * (Railway/Fly/ECS health checks all expect something like this). Checks the one
 * dependency that would make the app actually unusable if down: the database.
 *
 * Deliberately does NOT check Redis here — the web app degrades gracefully without it
 * (lyric import / export just won't enqueue), so a Redis blip shouldn't flip the whole
 * app's health check to failing and trigger a restart loop. Monitor worker/Redis health
 * separately (e.g. a BullMQ queue-depth alert) rather than through this endpoint.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "error", database: "down", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 503 }
    );
  }
}
