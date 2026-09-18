import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl, generatePkcePair, getOidcClient, SSO_STATE_COOKIE, type SsoStateCookiePayload } from "@/lib/sso";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const org = await db.org.findUnique({ where: { slug: params.slug } });
  if (!org || !org.ssoEnabled) {
    return NextResponse.json({ error: "SSO is not configured for this organization." }, { status: 404 });
  }

  const config = await db.ssoConfig.findUnique({ where: { orgId: org.id } });
  if (!config) return NextResponse.json({ error: "SSO is not configured for this organization." }, { status: 404 });

  const redirectUri = `${appUrl()}/api/sso/${params.slug}/callback`;
  const client = await getOidcClient(config, redirectUri);
  const { codeVerifier, codeChallenge, state } = await generatePkcePair();

  const authorizationUrl = client.authorizationUrl({
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const res = NextResponse.redirect(authorizationUrl);
  const payload: SsoStateCookiePayload = { codeVerifier, state, orgId: org.id };
  res.cookies.set(SSO_STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty for an IdP redirect round trip
    path: "/",
  });
  return res;
}
