import { randomBytes } from "crypto";
import { db } from "./db";

/**
 * Public project share slugs are random, not name-derived (unlike org slugs in
 * lib/org-slug.ts, which are meant to be typed in by hand at /login/sso). A booklet's
 * public link is meant to be unguessable — an artist's unreleased project shouldn't be
 * discoverable just by guessing `/p/artist-name`.
 */
export async function generateUniqueProjectSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomBytes(6).toString("base64url"); // 8 chars, URL-safe
    const existing = await db.project.findUnique({ where: { publicSlug: candidate } });
    if (!existing) return candidate;
  }
  // Astronomically unlikely to ever reach here at this keyspace size, but fail loudly
  // rather than silently return a colliding slug.
  throw new Error("Could not generate a unique public slug after 5 attempts.");
}
