import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreateProject } from "@/lib/entitlements";

const FORMAT_PAGE_PRESETS: Record<string, string[]> = {
  blank: ["Page 1"],
  cd: ["Front Cover", "Inner Spread", "Lyrics", "Credits", "Back Tray"],
  cassette: ["J-Card: Front / Spine / Back"],
  vinyl: ["Front", "Back", "Inner Sleeve A", "Inner Sleeve B"],
};

function defaultPagesForFormat(formatId: string) {
  const names = FORMAT_PAGE_PRESETS[formatId] ?? FORMAT_PAGE_PRESETS.blank;
  return names.map((name, i) => ({ name, order: i, blocks: [] }));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projects = await db.project.findMany({ where: { orgId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orgId, name, artist, formatId } = body as { orgId?: string; name?: string; artist?: string; formatId?: string };
  if (!orgId || !formatId) return NextResponse.json({ error: "orgId and formatId are required" }, { status: 400 });

  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || membership.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await db.org.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const currentCount = await db.project.count({ where: { orgId } });
  if (!canCreateProject(org.tier, currentCount)) {
    return NextResponse.json(
      { error: "Project limit reached for the current tier", code: "TIER_LIMIT" },
      { status: 402 }
    );
  }

  const project = await db.project.create({
    data: {
      orgId,
      name: name || "Untitled Release",
      artist,
      formatId,
      metadata: {
        title: name || "",
        artist: artist || "",
        releaseDate: "",
        tracklist: "",
        contributors: "",
        label: "",
        catalogNumber: "",
        notes: "",
      },
      theme: {
        id: "mono",
        bg: "#f2f2f0",
        text: "#141414",
        accent: "#141414",
        texture: "none",
        fontHeadline: "Share Tech Mono",
        fontBody: "Inter",
      },
      pages: { create: defaultPagesForFormat(formatId) },
    },
    include: { pages: true },
  });

  return NextResponse.json({ project }, { status: 201 });
}
