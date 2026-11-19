// Accès Supabase côté serveur, sans dépendance. Inactif tant que les variables ne sont pas posées :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
export const supabaseReady = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Identifie l'utilisateur à partir du jeton envoyé par l'app (Authorization: Bearer ...).
export async function userFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !supabaseReady()) return null;
  const r = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
    headers: { Authorization: "Bearer " + token, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!r.ok) return null;
  return r.json();
}

// Écrit l'état d'abonnement (table public.abonnements, écriture réservée au serveur).
export async function upsertAbonnement(row) {
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/abonnements?on_conflict=user_id", {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("Supabase " + r.status + " " + (await r.text()));
}

export async function getAbonnement(userId) {
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/abonnements?select=*&user_id=eq." + encodeURIComponent(userId), {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
  const j = r.ok ? await r.json() : [];
  return j[0] || null;
}
