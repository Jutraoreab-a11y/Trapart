// Appels Stripe sans dépendance : API REST et vérification de signature des webhooks.
import crypto from "node:crypto";

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}

export async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? form(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ? j.error.message : "Erreur Stripe " + r.status);
  return j;
}

// Vérifie l'en-tête Stripe-Signature (schéma v1, tolérance 5 minutes).
export function verifyWebhook(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const t = Number(parts.t), sigs = header.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
