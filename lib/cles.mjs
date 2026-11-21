// Clés d'API FALT : seule l'empreinte SHA-256 est stockée (table public.api_cles).
import { createHash } from "node:crypto";

const BASE = () => process.env.SUPABASE_URL + "/rest/v1";
const H = (extra = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
  ...extra,
});

export const FORMAT_CLE = /^falt_sk_[A-Za-z0-9]{32}$/;
export const hashCle = (cle) => createHash("sha256").update(cle).digest("hex");

// Lit la clé dans « Authorization: Bearer … » ou « x-api-key ». Jamais dans l'URL.
export function cleDeLaRequete(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return (request.headers.get("x-api-key") || "").trim();
}

// Renvoie { id, user_id } pour une clé valide et non révoquée, sinon null.
export async function verifierCle(request) {
  const cle = cleDeLaRequete(request);
  if (!FORMAT_CLE.test(cle)) return null;
  const r = await fetch(`${BASE()}/api_cles?select=id,user_id&revoquee_le=is.null&hash=eq.${hashCle(cle)}`, { headers: H() });
  const rows = r.ok ? await r.json() : [];
  if (!rows[0]) return null;
  await fetch(`${BASE()}/api_cles?id=eq.${rows[0].id}`, {
    method: "PATCH",
    headers: H({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ dernier_usage: new Date().toISOString() }),
  }).catch(() => {});
  return rows[0];
}

export async function listerCles(userId) {
  const r = await fetch(
    `${BASE()}/api_cles?select=id,nom,prefixe,cree_le,dernier_usage&revoquee_le=is.null&order=cree_le.desc&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: H() }
  );
  return r.ok ? r.json() : [];
}

export async function creerCle(userId, { nom, prefixe, hash }) {
  const r = await fetch(`${BASE()}/api_cles`, {
    method: "POST",
    headers: H({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ user_id: userId, nom, prefixe, hash }),
  });
  if (!r.ok) throw new Error("Supabase " + r.status);
  const rows = await r.json();
  return rows[0];
}

export async function revoquerCle(userId, id) {
  const r = await fetch(`${BASE()}/api_cles?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: H({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ revoquee_le: new Date().toISOString() }),
  });
  return r.ok;
}

// Résumé du patrimoine écrit par l'app (colonne snapshot de public.patrimoine).
export async function snapshotDe(userId) {
  const r = await fetch(`${BASE()}/patrimoine?select=snapshot,maj_le&user_id=eq.${encodeURIComponent(userId)}`, { headers: H() });
  const rows = r.ok ? await r.json() : [];
  return rows[0]?.snapshot || null;
}
