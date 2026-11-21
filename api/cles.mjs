// Gestion des clés d'API depuis l'app (compte connecté requis).
// GET : liste · POST {nom, prefixe, hash} : enregistre · DELETE ?id= : révoque.
import { json, sameOrigin } from "../lib/http.mjs";
import { userFromRequest, supabaseReady } from "../lib/supabase.mjs";
import { listerCles, creerCle, revoquerCle } from "../lib/cles.mjs";

async function garde(request) {
  if (!sameOrigin(request)) return { err: json({ error: "Origine non autorisée" }, 403) };
  if (!supabaseReady()) return { err: json({ error: "Les comptes FALT en ligne ne sont pas encore activés." }, 503) };
  const user = await userFromRequest(request);
  if (!user) return { err: json({ error: "Connectez-vous pour gérer vos clés." }, 401) };
  return { user };
}

export async function GET(request) {
  const { user, err } = await garde(request);
  if (err) return err;
  return json({ cles: await listerCles(user.id) });
}

export async function POST(request) {
  const { user, err } = await garde(request);
  if (err) return err;
  let b;
  try { b = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const nom = String(b.nom || "").trim().slice(0, 60);
  if (!nom || !/^falt_sk_[A-Za-z0-9]{4}$/.test(b.prefixe || "") || !/^[0-9a-f]{64}$/.test(b.hash || "")) {
    return json({ error: "Clé invalide" }, 400);
  }
  if ((await listerCles(user.id)).length >= 10) return json({ error: "10 clés actives au maximum. Révoquez-en une." }, 409);
  try {
    const c = await creerCle(user.id, { nom, prefixe: b.prefixe, hash: b.hash });
    return json({ cle: { id: c.id, nom: c.nom, prefixe: c.prefixe, cree_le: c.cree_le } }, 201);
  } catch (e) {
    return json({ error: "Enregistrement impossible" }, 502);
  }
}

export async function DELETE(request) {
  const { user, err } = await garde(request);
  if (err) return err;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Identifiant manquant" }, 400);
  return (await revoquerCle(user.id, id)) ? json({ ok: true }) : json({ error: "Révocation impossible" }, 502);
}
