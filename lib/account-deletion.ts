import { db } from "./db";

export interface BlockingOrg {
  id: string;
  name: string;
  reason: string;
}

/**
 * Deletes a user's account. This is more than a single DELETE because a user can be the
 * sole ADMIN of an org other people depend on — deleting them out from under a team
 * would silently orphan that org (no one left who can manage roles, billing, or SSO).
 *
 * Semantics:
 *  - An org where this user is the ADMIN and other members exist is a BLOCKER: the
 *    caller must transfer admin to someone else or remove the other members first.
 *    Nothing is deleted if any blockers exist — this check runs before any mutation.
 *  - An org where this user is the only member (any role) is deleted entirely, cascading
 *    its projects/assets/jobs/audit log via the schema's onDelete: Cascade rules.
 *  - An org where this user is a non-admin member alongside others just loses their
 *    membership row (via the User's cascade) when the User itself is deleted below —
 *    no separate action needed for those.
 */
export async function deleteUserAccount(userId: string): Promise<{ ok: true } | { ok: false; blockingOrgs: BlockingOrg[] }> {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { org: { include: { memberships: true } } },
  });

  const blockingOrgs: BlockingOrg[] = [];
  const soleOwnedOrgIds: string[] = [];

  for (const membership of memberships) {
    const otherMembers = membership.org.memberships.filter((m) => m.userId !== userId);
    if (otherMembers.length === 0) {
      // Solo org (regardless of role) — safe to delete outright.
      soleOwnedOrgIds.push(membership.orgId);
    } else if (membership.role === "ADMIN") {
      // Other people depend on this org and this user is the one managing it.
      blockingOrgs.push({
        id: membership.orgId,
        name: membership.org.name,
        reason: "You're the only admin of this organization, which has other members. Promote another member to admin first.",
      });
    }
    // else: non-admin member of an org with others — no action needed, their
    // membership disappears when the User row cascades below.
  }

  if (blockingOrgs.length > 0) {
    return { ok: false, blockingOrgs };
  }

  await db.$transaction([
    ...soleOwnedOrgIds.map((orgId) => db.org.delete({ where: { id: orgId } })),
    db.user.delete({ where: { id: userId } }),
  ]);

  return { ok: true };
}
