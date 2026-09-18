import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/sso";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });
const schema = z.object({ orgId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const { orgId } = parsed.data;

  const membership = await db.membership.findUnique({ where: { userId_orgId: { userId: session.user.id, orgId } } });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await db.org.findUnique({ where: { id: orgId } });
  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: "This org has no billing history yet — upgrade a tier first." }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl()}/app`,
  });

  return NextResponse.json({ url: portalSession.url });
}
