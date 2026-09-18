import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(1), newPassword: z.string().min(8).max(200) });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`reset-password:${ip}`, 10, 15 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.newPassword);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
