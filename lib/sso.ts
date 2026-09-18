import type { SsoConfig } from "@prisma/client";
import { encode as encodeSessionJwt } from "next-auth/jwt";
import { decryptSecret } from "./crypto";

/**
 * Multi-tenant SSO integration point for the Enterprise tier (product spec §10/§13).
 *
 * NextAuth v4's provider list is fixed at boot, which doesn't fit "each org brings its
 * own IdP" — so instead of registering a NextAuth provider, we run the OIDC
 * authorization-code + PKCE flow ourselves as plain route handlers
 * (app/api/sso/[slug]/login, app/api/sso/[slug]/callback) using `openid-client`, and on
 * success mint the exact same JWT session cookie NextAuth's credentials flow would —
 * so the rest of the app (getServerSession, middleware, useSession) doesn't need to know
 * SSO exists at all.
 */

export function appUrl(): string {
  return process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function getOidcClient(config: SsoConfig, redirectUri: string) {
  const { Issuer } = await import("openid-client");
  const issuer = await Issuer.discover(config.issuer);
  const clientSecret = decryptSecret(config.clientSecretEncrypted);
  return new issuer.Client({
    client_id: config.clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ["code"],
  });
}

export async function generatePkcePair() {
  const { generators } = await import("openid-client");
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();
  return { codeVerifier, codeChallenge, state };
}

export const SSO_STATE_COOKIE = "bs_sso_state";

export interface SsoStateCookiePayload {
  codeVerifier: string;
  state: string;
  orgId: string;
}

/** Session cookie name NextAuth v4 uses for JWT-strategy sessions. */
export function sessionCookieName(): string {
  const secure = appUrl().startsWith("https://");
  return secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

/** Mints the same JWT NextAuth's own sign-in flow would issue, so the resulting session is indistinguishable from a credentials login. */
export async function mintSessionToken(user: { id: string; email: string; name?: string | null }): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return encodeSessionJwt({
    token: { userId: user.id, email: user.email, name: user.name ?? undefined, sub: user.id },
    secret,
  });
}
