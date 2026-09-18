import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { generateUniqueOrgSlug } from "@/lib/org-slug";
import { parseBody, signupSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`signup:${ip}`, 5, 60 * 60); // 5 signups/hour/IP
  if (!allowed) {
    return NextResponse.json({ error: "Too many signup attempts from this network. Please try again later." }, { status: 429 });
  }

  const parsed = await parseBody(req, signupSchema);
  if ("error" in parsed) return parsed.error;
  const { email, password, name, orgName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({ data: { email, name, passwordHash } });

  const finalOrgName = orgName || (name ? `${name}'s Workspace` : "My Workspace");
  const slug = await generateUniqueOrgSlug(finalOrgName);

  const org = await db.org.create({
    data: {
      name: finalOrgName,
      slug,
      tier: "FREE",
      memberships: { create: { userId: user.id, role: "ADMIN" } },
    },
  });

  return NextResponse.json({ ok: true, userId: user.id, orgId: org.id }, { status: 201 });
}
