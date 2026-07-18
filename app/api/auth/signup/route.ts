import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, password, name, orgName } = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
    orgName?: string;
  };

  if (!email || !password) return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({ data: { email, name, passwordHash } });

  const org = await db.org.create({
    data: {
      name: orgName || (name ? `${name}'s Workspace` : "My Workspace"),
      tier: "FREE",
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });

  return NextResponse.json({ ok: true, userId: user.id, orgId: org.id }, { status: 201 });
}
