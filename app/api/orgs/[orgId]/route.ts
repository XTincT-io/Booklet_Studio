import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

const schema = z.object({ confirmName: z.string().min(1) });

export async function DELETE(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.org.findUnique({ where: { id: params.orgId }, include: { memberships: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = org.memberships.find((m) => m.userId === session.user.id);
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const otherMembers = org.memberships.filter((m) => m.userId !== session.user.id);
  if (otherMembers.length > 0) {
    return NextResponse.json(
      { error: "This organization has other members. Remove them first, or transfer admin and have them delete it instead." },
      { status: 400 }
    );
  }

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  // "Type the org name to confirm" — cheap, well-understood pattern for an irreversible
  // action, and doesn't require re-entering a password for something this scoped.
  if (parsed.data.confirmName !== org.name) {
    return NextResponse.json({ error: "The organization name you typed doesn't match. Nothing was deleted." }, { status: 400 });
  }

  // Cascades projects, assets, jobs, audit log, SSO config, and this membership itself
  // via the schema's onDelete: Cascade rules — see prisma/schema.prisma.
  await db.org.delete({ where: { id: params.orgId } });

  return NextResponse.json({ ok: true });
}
