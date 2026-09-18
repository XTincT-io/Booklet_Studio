import { Prisma } from "@prisma/client";
import { db } from "./db";
import { captureError } from "./monitoring";

/**
 * Append-only audit trail, distinct from AnalyticsEvent (which is aggregate/anonymous
 * usage data). Every permission or content change that matters for compliance goes
 * through here. Writing an audit entry never blocks or fails the request it's attached
 * to — a logging failure shouldn't take down the action being logged.
 */
export type AuditAction =
  | "project.created"
  | "project.deleted"
  | "member.added"
  | "member.role_changed"
  | "member.removed"
  | "org.tier_changed"
  | "org.sso_configured"
  | "org.sso_removed";

export async function logAudit(params: {
  orgId: string;
  actorId: string;
  action: AuditAction;
  targetId?: string;
  meta?: Prisma.InputJsonObject;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: params.orgId,
        actorId: params.actorId,
        action: params.action,
        targetId: params.targetId,
        meta: params.meta,
      },
    });
  } catch (err) {
    // Never let audit logging fail the request it's describing.
    captureError(err, { source: "audit-log", action: params.action, orgId: params.orgId });
  }
}
