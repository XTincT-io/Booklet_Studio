import { NextRequest, NextResponse } from "next/server";

/**
 * MOCK UPLOAD ROUTE (Development Only)
 * Allows testing the asset upload flow without real AWS credentials.
 */
export async function PUT(req: NextRequest) {
  // Security: only allow this route in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  console.log(`[DEV MOCK UPLOAD] Received file for key: ${key}`);
  
  // Return a 200 OK to simulate a successful S3 upload
  return new Response(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
