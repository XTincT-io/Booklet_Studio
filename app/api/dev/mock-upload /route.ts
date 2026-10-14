import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  console.log(`[DEV MOCK UPLOAD] Received file for key: ${searchParams.get("key")}`);
  return new Response(null, { status: 200 });
}
export async function POST(req: NextRequest) { return PUT(req); }
