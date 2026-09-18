import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { sendEmail } from "./email";
import { appUrl } from "./sso";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  // sha256 (not bcrypt) is the right tool here: the token itself is 256 bits of random
  // entropy, not a low-entropy human password — it isn't brute-forceable, so we don't
  // need bcrypt's deliberate slowness, just a one-way transform so a stolen DB row alone
  // isn't a usable reset link.
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createPasswordResetRequest(email: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  // Deliberately silent on "no such user" / "SSO-only account with no password" — the
  // caller (the API route) always returns the same generic success message regardless,
  // so this function's return value never leaks whether an email is registered.
  if (!user || !user.passwordHash) return;

  const rawToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: "Reset your Booklet Studio password",
    html: `<p>Someone requested a password reset for this account. If that was you, click below — this link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

export async function consumePasswordResetToken(rawToken: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenHash = hashToken(rawToken);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return { ok: true };
}
