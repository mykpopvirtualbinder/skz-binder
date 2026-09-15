import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getShopProduct,
  getShopEuroPriceForCheckout,
  applyDiscountPercent,
  parseDiscountPercent,
} from "@/lib/shop-catalog";
import { isEquipoVipEmail } from "@/lib/equipo-vip";
import { isAdminTeamEmail } from "@/lib/admin-emails";
import { fetchShopUsageCounts } from "@/lib/shop-user-usage";
import type { ShopProductId } from "@/lib/shop-catalog";
import { createStripeClient } from "@/lib/stripe-server";

const STRIPE_MIN_EUR = 0.5;

function originFromRequest(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = req.headers.get("origin") || req.headers.get("referer");
  if (h) {
    try {
      return new URL(h).origin;
    } catch {
      /* fallthrough */
    }
  }
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabaseAuth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabaseAuth.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { productId?: string; discountCode?: string | null };
  try {
    body = (await req.json()) as { productId?: string; discountCode?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productId = body.productId as ShopProductId | undefined;
  const product = productId ? getShopProduct(productId) : null;
  if (!product || !productId) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  const { data: profile, error: profileErr } = await supabaseAuth
    .from("profiles")
    .select("is_premium, plan_type")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  const email = user.email ?? null;
  const isUserVip = !!(profile.is_premium || isEquipoVipEmail(email));
  const isAdmin = isAdminTeamEmail(email);

  const used = await fetchShopUsageCounts(supabaseAuth, user.id);
  const baseEuro = getShopEuroPriceForCheckout(product, profile, used, { isUserVip, isAdmin });
  if (baseEuro === null) {
    return NextResponse.json(
      { error: "Este artículo no requiere pago con tarjeta (beneficio VIP). Usa el canje en la tienda." },
      { status: 400 }
    );
  }

  const discountPct = parseDiscountPercent(body.discountCode);
  const finalEuro = applyDiscountPercent(baseEuro, discountPct);
  if (finalEuro < STRIPE_MIN_EUR) {
    return NextResponse.json(
      {
        error:
          finalEuro <= 0
            ? "Importe 0 €: no se puede cobrar con tarjeta. Usa canje con K-oins o quita el descuento."
            : `El importe mínimo con tarjeta es ${STRIPE_MIN_EUR} € (Stripe).`,
      },
      { status: 400 }
    );
  }

  const unitAmount = Math.round(finalEuro * 100);
  const origin = originFromRequest(req);
  const successUrl = `${origin}/shop?checkout=success`;
  const cancelUrl = `${origin}/shop?checkout=cancel`;

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe not configured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const metadata: Record<string, string> = {
    supabase_user_id: user.id,
    product_id: productId,
  };

  try {
    if (product.isSub) {
      const interval = productId === "vip_year" ? "year" : "month";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: unitAmount,
              recurring: { interval },
              product_data: {
                name: product.name,
                metadata: { product_id: productId },
              },
            },
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        subscription_data: {
          metadata: { ...metadata },
        },
      });
      if (!session.url) {
        return NextResponse.json({ error: "Stripe did not return a URL" }, { status: 500 });
      }
      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: unitAmount,
            product_data: {
              name: product.name,
              metadata: { product_id: productId },
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a URL" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
