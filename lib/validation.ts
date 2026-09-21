import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";

/**
 * Runtime validation for request bodies. Previously most routes did
 * `(await req.json()) as { field?: string }` with manual null checks — fine for shape,
 * but a malformed or hostile payload (wrong types, huge strings, extra fields) could
 * still reach Prisma and surface as a raw 500 instead of a clean 400. This wraps
 * `req.json()` + a zod schema into one call that either returns validated data or an
 * already-formed NextResponse to return immediately.
 */
export async function parseBody<T extends ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  return { data: result.data };
}

// Lowercased so every email-keyed lookup (signup, login, invites, password reset, SSO)
// agrees on the same value regardless of how the user or an IdP capitalized it — Postgres
// text equality is case-sensitive by default, so without this, "Person@Co.com" and
// "person@co.com" would silently be treated as two different accounts.
const email = z.string().trim().toLowerCase().min(1).max(320).email();
const role = z.enum(["ADMIN", "DESIGNER", "COLLABORATOR", "VIEWER"]);

export const signupSchema = z.object({
  email,
  password: z.string().min(8).max(200),
  // React's controlled inputs send "" (not undefined) for a blank optional field — plain
  // `.optional()` doesn't cover that, since an explicit empty string still has to pass
  // .min(1). Transform blank/whitespace-only input to undefined instead of rejecting it,
  // so leaving the Name field empty at signup actually works the way the UI implies it
  // does (no `required` attribute, nothing marking it mandatory).
  name: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  orgName: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
});

export const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const addMemberSchema = z.object({
  email,
  role,
});

export const removeMemberSchema = z.object({
  membershipId: z.string().min(1),
});

export const createProjectSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().trim().max(200).optional(),
  artist: z.string().trim().max(200).optional(),
  formatId: z.enum(["blank", "cd", "cassette", "vinyl"]),
});

export const parseJobSchema = z.object({
  key: z.string().min(1).max(1024),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
});

export const exportJobSchema = z.object({
  type: z.enum(["PDF", "WEB_BUNDLE", "IMAGES"]),
});

export const trackEventSchema = z.object({
  projectId: z.string().min(1),
  // .nullish() (not .optional()): both the exported web-viewer bundle's vanilla JS and
  // the React Preview Viewer can send an explicit `null` for pageId (e.g. "no page
  // context available"), not just omit the field entirely — plain .optional() only
  // covers `undefined` and would reject a real `null` from either caller.
  pageId: z.string().min(1).nullish(),
  type: z.enum(["view", "hotspot_open", "audio_play"]),
});

export const ssoConfigSchema = z.object({
  issuer: z.string().trim().url().max(500),
  clientId: z.string().trim().min(1).max(500),
  // Required when first enabling SSO; optional on update (blank = "keep current secret") —
  // enforced in the route itself, since that depends on whether a config already exists.
  clientSecret: z.string().min(1).max(2000).optional().or(z.literal("")),
  defaultRole: role.optional(),
});
