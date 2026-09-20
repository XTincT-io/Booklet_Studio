import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { deleteUserAccount } from "@/lib/account-deletion";
import { logAudit } from "@/lib/audit";

const schema = z.object({ confirm: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  // Password confirmation for accounts that have one; SSO-only accounts (no
  // passwordHash) confirm by typing their exact email instead, since there's no
  // password to check.
  if (user.passwordHash) {
    const valid = await bcrypt.compare(parsed.data.confirm, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Incorrect password. Nothing was deleted." }, { status: 400 });
  } else if (parsed.data.confirm !== user.email) {
    return NextResponse.json({ error: "That doesn't match your account email. Nothing was deleted." }, { status: 400 });
  }

  // Capture membership org ids for the audit log *before* deleting — there's nothing
  // left to attach a log entry to for orgs that get deleted alongside the account, but
  // orgs the user merely leaves (non-admin, other members present) still exist afterward
  // and should show this in their audit trail.
  const orgIdsUserRemainsRelevantTo = (
    await db.membership.findMany({ where: { userId: session.user.id }, select: { orgId: true, role: true } })
  ).filter((m) => m.role !== "ADMIN");

  const result = await deleteUserAccount(session.user.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Can't delete your account yet — you're the only admin of one or more organizations with other members.",
        blockingOrgs: result.blockingOrgs,
      },
      { status: 400 }
    );
  }

  for (const { orgId } of orgIdsUserRemainsRelevantTo) {
    await logAudit({ orgId, actorId: session.user.id, action: "member.removed", targetId: session.user.id, meta: { reason: "account_deleted" } });
  }

  return NextResponse.json({ ok: true });
}
