// Ouvre une session de paiement Stripe Checkout pour l'utilisateur connecté.
// Variables : STRIPE_SECRET_KEY, STRIPE_PRICE_PACK, STRIPE_PRICE_MODULE, (option) STRIPE_AUTOMATIC_TAX=1
// Nécessite aussi Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) pour identifier le client.
import { json, sameOrigin } from "../lib/http.mjs";
import { stripe } from "../lib/stripe.mjs";
import { userFromRequest, supabaseReady, getAbonnement } from "../lib/supabase.mjs";

const MODULES = ["m1", "m2", "m3", "m4"];

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Origine non autorisée" }, 403);
  if (!process.env.STRIPE_SECRET_KEY || !supabaseReady()) return json({ error: "Le paiement en ligne n'est pas encore activé." }, 503);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Connectez-vous pour vous abonner." }, 401);
  let body = {};
  try { body = await request.json(); } catch {}
  const plan = body.plan === "carte" ? "carte" : "pack";
  const modules = plan === "pack" ? MODULES : [...new Set((body.modules || []).filter(m => MODULES.includes(m)))];
  if (plan === "carte" && !modules.length) return json({ error: "Choisissez au moins un module." }, 400);
  const price = plan === "pack" ? process.env.STRIPE_PRICE_PACK : process.env.STRIPE_PRICE_MODULE;
  if (!price) return json({ error: "Tarif Stripe non configuré." }, 503);

  const origin = new URL(request.url).origin;
  const existing = await getAbonnement(user.id);
  const meta = { user_id: user.id, plan, modules: modules.join(",") };
  try {
    const session = await stripe("POST", "checkout/sessions", {
      mode: "subscription",
      line_items: { 0: { price, quantity: plan === "pack" ? 1 : modules.length } },
      ...(existing && existing.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: meta,
      subscription_data: { metadata: meta },
      allow_promotion_codes: "true",
      billing_address_collection: "required",
      tax_id_collection: { enabled: "true" },
      ...(process.env.STRIPE_AUTOMATIC_TAX === "1" ? { automatic_tax: { enabled: "true" } } : {}),
      locale: "fr",
      success_url: origin + "/app.html?paiement=ok",
      cancel_url: origin + "/app.html?paiement=annule",
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: "Impossible d'ouvrir le paiement : " + e.message }, 502);
  }
}
