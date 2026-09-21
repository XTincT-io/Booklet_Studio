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

  let user;
  if (existing) {
    // An admin can invite someone by email before they've ever signed up (see
    // app/api/orgs/[orgId]/members/route.ts), which creates a User row with no
    // password. Without this branch, that person could never actually get in: signup
    // would reject them as "already exists," and login would reject them for having no
    // password — a real dead end, not a hypothetical one. If they already have a
    // password, this is a genuine duplicate signup and should still be rejected.
    if (existing.passwordHash) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = await db.user.update({ where: { id: existing.id }, data: { passwordHash, name: name ?? existing.name } });
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await db.user.create({ data: { email, name, passwordHash } });
  }

  // Someone claiming a pre-provisioned invite already has org membership(s) from being
  // invited — creating a brand-new personal workspace for them on top of that would be
  // surprising, not helpful. Only create one for a genuinely new signup.
  if (existing) {
    return NextResponse.json({ ok: true, userId: user.id, orgId: null }, { status: 201 });
  }

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
