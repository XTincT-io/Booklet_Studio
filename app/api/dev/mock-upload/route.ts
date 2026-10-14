import { NextRequest, NextResponse } from "next/server";

/**
 * DEV ONLY: mocks a successful asset upload without requiring real cloud storage.
 * This route must stay behind the development guard to avoid exposing upload behavior in production.
 */
export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing required query param: key" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "application/octet-stream";
  const contentLengthHeader = req.headers.get("content-length");
  const sizeBytes = contentLengthHeader ? Number(contentLengthHeader) : null;

  let actualSize: number | null = sizeBytes;
  if (actualSize === null || Number.isNaN(actualSize)) {
    try {
      const body = await req.arrayBuffer();
      actualSize = body.byteLength;
    } catch {
      actualSize = 0;
    }
  }

  console.log(`[DEV MOCK UPLOAD] Received file for key: ${key}, contentType: ${contentType}, sizeBytes: ${actualSize}`);

  return NextResponse.json(
    {
      ok: true,
      key,
      contentType,
      sizeBytes: actualSize,
      message: "Mock upload successful",
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  return PUT(req);
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  return NextResponse.json({
    ok: true,
    route: "/api/dev/mock-upload",
    key,
    mode: "dev-mock",
  });
}
