import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import type { Tier } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

async function tierFromSubscription(subscriptionId: string): Promise<Tier | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = sub.items.data[0]?.price.id;
  if (priceId === process.env.STRIPE_PRICE_INDIE_ARTIST) return "INDIE_ARTIST";
  if (priceId === process.env.STRIPE_PRICE_INDIE_LABEL) return "INDIE_LABEL";
  return null;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orgId = checkoutSession.client_reference_id;
    const subscriptionId = checkoutSession.subscription as string | null;

    if (orgId && subscriptionId) {
      const tier = await tierFromSubscription(subscriptionId);
      if (tier) {
        await db.org.update({
          where: { id: orgId },
          data: { tier, stripeSubscriptionId: subscriptionId },
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const org = await db.org.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (org) {
      await db.org.update({ where: { id: org.id }, data: { tier: "FREE", stripeSubscriptionId: null } });
    }
  }

  return NextResponse.json({ received: true });
}
