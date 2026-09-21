import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getRedisConnection } from "@/lib/queue";
import { captureError } from "@/lib/monitoring";
import type { Tier } from "@prisma/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

function tierFromPriceId(priceId: string | undefined): Tier | null {
  if (priceId === process.env.STRIPE_PRICE_INDIE_ARTIST) return "INDIE_ARTIST";
  if (priceId === process.env.STRIPE_PRICE_INDIE_LABEL) return "INDIE_LABEL";
  return null;
}

async function tierFromSubscription(subscriptionId: string): Promise<Tier | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return tierFromPriceId(sub.items.data[0]?.price.id);
}

/**
 * Stripe delivers webhooks at-least-once — the same event id can legitimately arrive
 * more than once (retries, redelivery from the dashboard, etc). Re-applying the same
 * tier is harmless on its own, but it would double the audit log entry for a single real
 * event. Guards against that with a short-lived Redis key rather than a dedicated table —
 * webhook redelivery windows are minutes, not days, so this doesn't need to be permanent.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = `stripe-webhook-processed:${eventId}`;
    // SET ... NX returns null if the key already existed (i.e. we've seen this event id
    // before); EX gives it a 24h expiry so this doesn't grow unbounded.
    const result = await redis.set(key, "1", "EX", 60 * 60 * 24, "NX");
    return result === null;
  } catch (err) {
    // Fails open (treat as not-yet-processed) — Redis being briefly unavailable
    // shouldn't cause us to silently drop a real billing event.
    captureError(err, { source: "stripe-webhook-idempotency" });
    return false;
  }
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

  if (await alreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, deduped: true });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orgId = checkoutSession.client_reference_id;
    const subscriptionId = checkoutSession.subscription as string | null;
    const customerId = checkoutSession.customer as string | null;

    if (orgId && subscriptionId) {
      // Defensive: the org this checkout session references could have been deleted
      // between checkout being started and this webhook arriving (a real, if narrow,
      // race). db.org.update throws on a missing record, which would otherwise cause an
      // unhandled 500 and put this event into Stripe's indefinite retry loop for an org
      // that will never exist again.
      const orgExists = await db.org.findUnique({ where: { id: orgId }, select: { id: true, tier: true } });
      if (!orgExists) {
        captureError(new Error("checkout.session.completed for a nonexistent org"), { orgId, eventId: event.id });
      } else {
        const tier = await tierFromSubscription(subscriptionId);
        if (tier) {
          await db.org.update({
            where: { id: orgId },
            data: { tier, stripeSubscriptionId: subscriptionId, ...(customerId ? { stripeCustomerId: customerId } : {}) },
          });
          await logAudit({ orgId, actorId: "system:stripe_webhook", action: "org.tier_changed", meta: { from: orgExists.tier, to: tier, via: "stripe_checkout" } });
        }
      }
    }
  }

  // Fires when a subscription's plan changes — including a customer switching tiers
  // themselves through the Stripe Billing Portal (see /api/billing/portal), which does
  // NOT fire checkout.session.completed again. Without this handler, a self-serve
  // upgrade/downgrade made through the portal would charge the customer correctly but
  // never actually change what tier they have access to in the app — a real desync, not
  // a hypothetical one, for anyone who exercises the portal we already built.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const org = await db.org.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (org) {
      const tier = tierFromPriceId(sub.items.data[0]?.price.id);
      if (tier && tier !== org.tier) {
        await db.org.update({ where: { id: org.id }, data: { tier } });
        await logAudit({ orgId: org.id, actorId: "system:stripe_webhook", action: "org.tier_changed", meta: { from: org.tier, to: tier, via: "stripe_subscription_updated" } });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const org = await db.org.findFirst({ where: { stripeSubscriptionId: sub.id } });
    if (org) {
      await db.org.update({ where: { id: org.id }, data: { tier: "FREE", stripeSubscriptionId: null } });
      await logAudit({ orgId: org.id, actorId: "system:stripe_webhook", action: "org.tier_changed", meta: { from: org.tier, to: "FREE", via: "stripe_subscription_deleted" } });
    }
  }

  return NextResponse.json({ received: true });
}
