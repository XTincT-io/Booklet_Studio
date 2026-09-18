import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniqueOrgSlug } from "@/lib/org-slug";
import { parseBody, createOrgSchema } from "@/lib/validation";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { org: true },
  });

  const orgs = memberships.map((m) => ({ id: m.org.id, name: m.org.name, tier: m.org.tier, role: m.role }));
  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, createOrgSchema);
  if ("error" in parsed) return parsed.error;
  const { name } = parsed.data;

  const slug = await generateUniqueOrgSlug(name);

  const org = await db.org.create({
    data: {
      name,
      slug,
      tier: "FREE",
      memberships: { create: { userId: session.user.id, role: "ADMIN" } },
    },
  });

  return NextResponse.json({ org: { id: org.id, name: org.name, tier: org.tier, role: "ADMIN" } }, { status: 201 });
}
