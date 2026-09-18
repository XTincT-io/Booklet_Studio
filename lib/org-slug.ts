import { db } from "./db";

/** URL/login-safe slug — also used as the org's SSO login path (/login/sso/[slug]). */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "org";
}

export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 0;
  // Small orgs, low collision risk — a short linear probe is plenty.
  while (await db.org.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
