import Stripe from "stripe";

/**
 * Secret API key only (sk_test_… / sk_live_…). Loaded on the server from env.
 */
export function createStripeClient(): Stripe {
  const raw = process.env.STRIPE_SECRET_KEY;
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) {
    const onVercel = process.env.VERCEL === "1";
    throw new Error(
      onVercel
        ? "Falta STRIPE_SECRET_KEY en Vercel. Project → Settings → Environment Variables: añade STRIPE_SECRET_KEY (valor sk_live_… o sk_test_… desde Stripe → Developers → API keys) para Production y Preview, guarda y vuelve a desplegar."
        : "Falta STRIPE_SECRET_KEY. En la raíz del repo, archivo .env.local (con punto), línea STRIPE_SECRET_KEY=sk_… Reinicia el terminal donde corre `next dev`."
    );
  }
  if (!key.startsWith("sk_")) {
    throw new Error(
      "STRIPE_SECRET_KEY no es la clave secreta correcta: debe empezar por sk_test_ o sk_live_ (Stripe Dashboard → Developers → API keys → Reveal secret key). No uses la clave publicable (pk_) ni otros prefijos."
    );
  }
  return new Stripe(key);
}
