// Reçoit les événements Stripe et met à jour l'abonnement dans Supabase.
// Variables : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Événements à cocher dans Stripe : checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
import { json } from "../lib/http.mjs";
import { stripe, verifyWebhook } from "../lib/stripe.mjs";
import { upsertAbonnement, supabaseReady } from "../lib/supabase.mjs";

const periodEnd = sub => {
  const t = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return t ? new Date(t * 1000).toISOString() : null;
};
const rowFromSub = (sub, extra = {}) => ({
  user_id: sub.metadata && sub.metadata.user_id,
  plan: (sub.metadata && sub.metadata.plan) === "pro" ? "pro" : "ultra",
  billing: (sub.metadata && sub.metadata.billing) === "mensuel" ? "mensuel" : "annuel",
  fondateur: (sub.metadata && sub.metadata.fondateur) === "oui",
  status: sub.status,
  stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer && sub.customer.id,
  stripe_subscription_id: sub.id,
  current_period_end: periodEnd(sub),
  ...extra,
});

export async function POST(request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) return json({ error: "Signature invalide" }, 400);
  if (!supabaseReady()) return json({ error: "Base de données non configurée" }, 503);
  const evt = JSON.parse(raw), obj = evt.data.object;
  try {
    if (evt.type === "checkout.session.completed" && obj.mode === "subscription") {
      const sub = await stripe("GET", "subscriptions/" + obj.subscription);
      const row = rowFromSub(sub);
      if (!row.user_id) row.user_id = obj.client_reference_id;
      if (row.user_id) await upsertAbonnement(row);
    } else if (evt.type === "customer.subscription.updated" || evt.type === "customer.subscription.deleted") {
      const row = rowFromSub(obj);
      if (row.user_id) await upsertAbonnement(row);
    }
  } catch (e) {
    return json({ error: e.message }, 500); // Stripe réessaiera
  }
  return json({ received: true });
}
