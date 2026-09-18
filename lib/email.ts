/**
 * Minimal transactional email sending, intentionally not tied to a specific provider's
 * SDK. If RESEND_API_KEY is set, sends via Resend's plain REST API (no extra dependency
 * needed for one HTTP call). Otherwise, logs the email to the console — good enough for
 * local dev, and means the password-reset flow is fully testable without a real email
 * provider configured. Swap the "no provider configured" branch for SES/Postmark/SendGrid
 * if you'd rather use one of those; the call site (lib/password-reset.ts) doesn't change.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Booklet Studio <no-reply@example.com>";

  if (!apiKey) {
    console.log(`[email:dev-mode] No RESEND_API_KEY set — would have sent:\n  To: ${params.to}\n  Subject: ${params.subject}\n  ${params.html}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send email via Resend (${res.status}): ${body}`);
  }
}
