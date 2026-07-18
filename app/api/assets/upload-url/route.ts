import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUploadUrl } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, filename, contentType } = (await req.json()) as {
    orgId?: string;
    filename?: string;
    contentType?: string;
  };
  if (!orgId || !filename || !contentType) {
    return NextResponse.json({ error: "orgId, filename, and contentType are required" }, { status: 400 });
  }

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { uploadUrl, publicUrl, key } = await createUploadUrl(orgId, filename, contentType);

  // The client PUTs the file directly to uploadUrl, then calls back to persist the Asset record
  // (a separate POST /api/assets that writes { orgId, key, url: publicUrl, type, sizeBytes } once the
  // upload succeeds) — omitted here for brevity but follows the same auth/membership pattern.

  return NextResponse.json({ uploadUrl, publicUrl, key });
}
