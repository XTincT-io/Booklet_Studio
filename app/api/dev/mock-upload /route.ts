import { NextRequest, NextResponse } from "next/server";

/**
 * Deprecated legacy path. Use /api/dev/mock-upload instead.
 */
export async function PUT(req: NextRequest) {
  return NextResponse.json(
    {
      error: "This legacy route is deprecated; use /api/dev/mock-upload instead.",
      movedTo: "/api/dev/mock-upload",
    },
    { status: 410 },
  );
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
