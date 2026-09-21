import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { createPasswordResetRequest } from "@/lib/password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email() }); // see lib/validation.ts's `email` const for why

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  // Always the same response whether or not the email exists / has a password set —
  // createPasswordResetRequest silently no-ops for both cases. Leaking which emails are
  // registered via response differences is a real (if minor) enumeration vector.
  await createPasswordResetRequest(parsed.data.email).catch((err) => {
    console.error("Failed to send password reset email:", err);
  });

  return NextResponse.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
}
