import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

const SELF_SERVE_PRICE_IDS: Record<string, string | undefined> = {
  INDIE_ARTIST: process.env.STRIPE_PRICE_INDIE_ARTIST,
  INDIE_LABEL: process.env.STRIPE_PRICE_INDIE_LABEL,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, tier } = (await req.json()) as { orgId?: string; tier?: string };
  if (!orgId || !tier) return NextResponse.json({ error: "orgId and tier are required" }, { status: 400 });

  const priceId = SELF_SERVE_PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json(
      { error: "This tier is not self-serve. Enterprise Label is arranged through sales." },
      { status: 400 }
    );
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/org/${orgId}?upgraded=1`,
    cancel_url: `${process.env.APP_URL}/org/${orgId}`,
    client_reference_id: orgId,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
