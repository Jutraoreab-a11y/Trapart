// Ouvre l'espace client Stripe (factures, carte, résiliation).
import { json, sameOrigin } from "../lib/http.mjs";
import { stripe } from "../lib/stripe.mjs";
import { userFromRequest, supabaseReady, getAbonnement } from "../lib/supabase.mjs";

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Origine non autorisée" }, 403);
  if (!process.env.STRIPE_SECRET_KEY || !supabaseReady()) return json({ error: "Le paiement en ligne n'est pas encore activé." }, 503);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Connectez-vous pour gérer votre abonnement." }, 401);
  const ab = await getAbonnement(user.id);
  if (!ab || !ab.stripe_customer_id) return json({ error: "Aucun abonnement à gérer pour ce compte." }, 404);
  try {
    const s = await stripe("POST", "billing_portal/sessions", { customer: ab.stripe_customer_id, return_url: new URL(request.url).origin + "/app.html", locale: "fr" });
    return json({ url: s.url });
  } catch (e) {
    return json({ error: "Impossible d'ouvrir l'espace client : " + e.message }, 502);
  }
}
