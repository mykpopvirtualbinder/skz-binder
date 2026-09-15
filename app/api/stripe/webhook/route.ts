import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { fulfillShopProduct } from "@/lib/fulfill-shop-order";
import { getShopProduct } from "@/lib/shop-catalog";
import type { ShopProductId } from "@/lib/shop-catalog";
import { createStripeClient } from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = createStripeClient().webhooks.constructEvent(body, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.supabase_user_id;
  const productId = session.metadata?.product_id as ShopProductId | undefined;

  if (!userId || !productId) {
    console.error("Stripe webhook: missing metadata", session.id);
    return NextResponse.json({ received: true });
  }

  const product = getShopProduct(productId);
  if (!product) {
    console.error("Stripe webhook: unknown product", productId);
    return NextResponse.json({ received: true });
  }

  const paymentOk =
    session.payment_status === "paid" ||
    (session.mode === "subscription" && session.status === "complete");

  if (!paymentOk) {
    return NextResponse.json({ received: true });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { error: lockErr } = await admin.from("stripe_fulfillments").insert({
    session_id: session.id,
    user_id: userId,
    product_id: productId,
  });

  if (lockErr) {
    const dup =
      lockErr.code === "23505" ||
      lockErr.message?.toLowerCase().includes("duplicate") ||
      lockErr.message?.toLowerCase().includes("unique");
    if (dup) {
      return NextResponse.json({ received: true });
    }
    console.error("stripe_fulfillments insert:", lockErr);
    return NextResponse.json({ error: "Fulfillment lock failed" }, { status: 500 });
  }

  try {
    await fulfillShopProduct(admin, userId, productId);
  } catch (e) {
    console.error("fulfillShopProduct:", e);
    await admin.from("stripe_fulfillments").delete().eq("session_id", session.id);
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
