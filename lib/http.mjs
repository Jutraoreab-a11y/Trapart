// Petits utilitaires partagés par les fonctions serveur.
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
// Refuse les appels venant d'un autre site (protège les quotas des fournisseurs).
export function sameOrigin(request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin") || request.headers.get("referer") || "";
  if (!origin) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
