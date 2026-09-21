import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl, getOidcClient, mintSessionToken, sessionCookieName, SSO_STATE_COOKIE, type SsoStateCookiePayload } from "@/lib/sso";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const org = await db.org.findUnique({ where: { slug: params.slug } });
  if (!org || !org.ssoEnabled) return NextResponse.json({ error: "SSO is not configured for this organization." }, { status: 404 });

  const config = await db.ssoConfig.findUnique({ where: { orgId: org.id } });
  if (!config) return NextResponse.json({ error: "SSO is not configured for this organization." }, { status: 404 });

  const rawState = req.cookies.get(SSO_STATE_COOKIE)?.value;
  if (!rawState) return NextResponse.json({ error: "SSO session expired — please try signing in again." }, { status: 400 });

  let statePayload: SsoStateCookiePayload;
  try {
    statePayload = JSON.parse(rawState);
  } catch {
    return NextResponse.json({ error: "Invalid SSO session." }, { status: 400 });
  }
  if (statePayload.orgId !== org.id) return NextResponse.json({ error: "Invalid SSO session." }, { status: 400 });

  const redirectUri = `${appUrl()}/api/sso/${params.slug}/callback`;
  const client = await getOidcClient(config, redirectUri);
  const params_ = client.callbackParams(req.url);

  let claims: { sub: string; email?: string; name?: string };
  try {
    const tokenSet = await client.callback(redirectUri, params_, {
      code_verifier: statePayload.codeVerifier,
      state: statePayload.state,
    });
    claims = tokenSet.claims() as { sub: string; email?: string; name?: string };
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "SSO sign-in failed." }, { status: 400 });
  }

  if (!claims.email) {
    return NextResponse.json({ error: "Your identity provider didn't return an email address, which Booklet Studio requires." }, { status: 400 });
  }
  const email = claims.email.toLowerCase(); // see lib/validation.ts's `email` const for why

  // Refuse to let SSO log into an account that already has its own independent
  // password. Without this, an org admin's OIDC provider — which they fully control —
  // could vouch for *any* email address, not just ones in their own organization, and
  // silently take over an existing password-protected account elsewhere on the
  // platform. SSO may only create new users or log into ones that were already
  // passwordless (e.g. provisioned by an admin invite that hasn't been claimed yet).
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser?.passwordHash) {
    return NextResponse.json(
      { error: "This email is already registered with a password. Log in normally instead of via SSO, or contact support to link accounts." },
      { status: 409 }
    );
  }

  const user = await db.user.upsert({
    where: { email },
    update: { name: claims.name ?? undefined },
    create: { email, name: claims.name ?? undefined },
  });

  // Provision membership on first SSO login; never downgrade an existing role.
  await db.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: {},
    create: { userId: user.id, orgId: org.id, role: config.defaultRole },
  });

  const sessionToken = await mintSessionToken({ id: user.id, email: user.email, name: user.name });

  const res = NextResponse.redirect(`${appUrl()}/app`);
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // matches NextAuth's default 30-day JWT session lifetime
  });
  res.cookies.delete(SSO_STATE_COOKIE);
  return res;
}
