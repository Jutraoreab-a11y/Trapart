// Connecteur MCP FALT pour Claude (transport HTTP « streamable », réponses JSON, sans état).
// Lecture seule : Claude lit le résumé du patrimoine écrit par l'app, il ne peut rien modifier.
// Authentification : clé FALT dans « Authorization: Bearer falt_sk_… » (ou « x-api-key »).
import { json } from "../lib/http.mjs";
import { supabaseReady } from "../lib/supabase.mjs";
import { verifierCle, snapshotDe } from "../lib/cles.mjs";

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MODULES = ["immo", "equity", "titres", "cash"];
const ULTRA = new Set(["equity"]);

const INSTRUCTIONS =
  "FALT consolide le patrimoine d'un dirigeant : Immo, Equity (sociétés lues dans le FEC), Titres et Cash. " +
  "Montants en euros. Commencez par patrimoine_resume. Les simulations Fiscool sont indicatives : " +
  "rappelez que les taux sont à vérifier selon la loi de finances en vigueur et qu'il ne s'agit pas d'un conseil fiscal.";

const TOOLS = [
  {
    name: "patrimoine_resume",
    title: "Résumé du patrimoine",
    description: "Patrimoine net, brut, dettes et répartition par module (Immo, Equity, Titres, Cash), avec la date de mise à jour.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "lister_actifs",
    title: "Lister les actifs",
    description: "Liste les lignes du patrimoine (nom, type, valeur, et dette restante pour l'immobilier), éventuellement pour un seul module.",
    inputSchema: {
      type: "object",
      properties: { module: { type: "string", enum: MODULES, description: "Module à lister. Tous si absent." } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "historique_patrimoine",
    title: "Historique du patrimoine net",
    description: "Évolution du patrimoine net dans le temps.",
    inputSchema: {
      type: "object",
      properties: { periode: { type: "string", enum: ["1M", "3M", "1A", "Tout"], description: "Période, 1A par défaut." } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "simuler_fiscool",
    title: "Simuler dividendes ou holding",
    description:
      "Compare la distribution en dividendes personnels et la remontée en holding (régime mère-fille) pour un résultat avant IS. " +
      "Sans paramètre, reprend les hypothèses enregistrées dans Fiscool. Offre Ultra.",
    inputSchema: {
      type: "object",
      properties: {
        resultat_avant_is: { type: "number", minimum: 0, description: "Résultat avant impôt sur les sociétés, en euros." },
        besoin_revenus: { type: "number", minimum: 0, description: "Revenus personnels souhaités sur l'année, en euros." },
        part_distribuee: { type: "number", minimum: 0, maximum: 100, description: "Part du bénéfice net arbitrée, en %." },
        pfu: { type: "number", minimum: 0, maximum: 100, description: "Prélèvement forfaitaire unique, en %." },
        holding: { type: "boolean", description: "Une holding détient au moins 5 % de la société." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const rpc = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const ok = (data, texte) => ({ content: [{ type: "text", text: texte || JSON.stringify(data, null, 2) }], structuredContent: data });
const echec = (message) => ({ content: [{ type: "text", text: message }], isError: true });
const r0 = (x) => Math.round(Number(x) || 0);

function isCalc(r) { r = Math.max(0, r); return Math.min(r, 42500) * 0.15 + Math.max(0, r - 42500) * 0.25; }
function fiscool(f) {
  const R = Number(f.resultat) || 0, IS = isCalc(R), N = R - IS;
  const D = N * Math.min(100, Number(f.distrib ?? 100)) / 100, pfu = (Number(f.pfu ?? 31.4)) / 100;
  const besoin = Math.min(Number(f.besoin) || 0, D), holding = f.holding !== false;
  const perso = besoin, hold = holding ? D - besoin : 0, reserve = holding ? 0 : D - besoin;
  const impotStrategie = perso * pfu + hold * 0.0125;
  return {
    hypotheses: { resultat_avant_is: r0(R), part_distribuee_pct: Number(f.distrib ?? 100), pfu_pct: pfu * 100, holding, besoin_revenus: r0(f.besoin) },
    impot_societes: r0(IS), benefice_net: r0(N), montant_arbitre: r0(D),
    tout_en_dividendes: { impot: r0(D * pfu), net_percu: r0(D * (1 - pfu)) },
    tout_en_holding: { impot: r0(D * 0.0125), disponible_en_holding: r0(D - D * 0.0125) },
    strategie_recommandee: { dividendes_personnels: r0(perso), remontee_holding: r0(hold), mise_en_reserve: r0(reserve), impot_total: r0(impotStrategie) },
    economie_vs_tout_dividendes: r0(D * pfu - impotStrategie),
    avertissement: "Simulation indicative : IS à 15 % jusqu'à 42 500 € puis 25 %, quote-part de frais et charges de 5 % en mère-fille. Taux à vérifier selon la loi de finances en vigueur. Ce n'est pas un conseil fiscal.",
  };
}

async function appeler(nom, args, cle) {
  const snap = await snapshotDe(cle.user_id);
  if (nom !== "simuler_fiscool" && !snap) {
    return echec("Aucun patrimoine synchronisé pour ce compte. Ouvrez FALT une fois pour l'envoyer, puis réessayez.");
  }
  const ultra = snap?.plan === "ultra";
  switch (nom) {
    case "patrimoine_resume": {
      const d = {
        mis_a_jour: snap.maj, devise: "EUR",
        patrimoine_net: snap.patrimoine_net, patrimoine_brut: snap.patrimoine_brut, dettes: snap.dettes,
        modules: (snap.modules || []).filter((m) => ultra || !ULTRA.has(m.module)),
      };
      return ok(d);
    }
    case "lister_actifs": {
      const m = args?.module;
      if (m && !MODULES.includes(m)) return echec("Module inconnu. Choisissez parmi : " + MODULES.join(", ") + ".");
      if (m && ULTRA.has(m) && !ultra) return echec("Le module Equity est inclus dans l'offre Ultra.");
      const lignes = (snap.lignes || []).filter((l) => (!m || l.module === m) && (ultra || !ULTRA.has(l.module)));
      return ok({ mis_a_jour: snap.maj, module: m || "tous", nombre: lignes.length, lignes });
    }
    case "historique_patrimoine": {
      const p = args?.periode || "1A", jours = { "1M": 31, "3M": 92, "1A": 366 }[p];
      const depuis = jours ? new Date(Date.now() - jours * 864e5).toISOString().slice(0, 10) : "";
      const points = (snap.historique || []).filter((h) => !depuis || h.date >= depuis);
      return ok({ periode: p, points });
    }
    case "simuler_fiscool": {
      if (snap && !ultra) return echec("Fiscool est inclus dans l'offre Ultra.");
      const base = snap?.fiscool || {};
      const f = {
        resultat: args?.resultat_avant_is ?? base.resultat,
        besoin: args?.besoin_revenus ?? base.besoin,
        distrib: args?.part_distribuee ?? base.distrib,
        pfu: args?.pfu ?? base.pfu,
        holding: args?.holding ?? base.holding,
      };
      if (!(Number(f.resultat) > 0)) return echec("Indiquez un résultat avant IS (resultat_avant_is) supérieur à zéro.");
      return ok(fiscool(f));
    }
    default:
      return null;
  }
}

async function traiter(m, cle) {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return rpcErr(m?.id, -32600, "Requête invalide");
  const notification = m.id === undefined || m.id === null;
  if (notification) return null;
  switch (m.method) {
    case "initialize": {
      const demande = m.params?.protocolVersion;
      return rpc(m.id, {
        protocolVersion: VERSIONS.includes(demande) ? demande : VERSIONS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "falt", title: "FALT", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpc(m.id, {});
    case "tools/list":
      return rpc(m.id, { tools: TOOLS });
    case "tools/call": {
      const nom = m.params?.name;
      if (!TOOLS.some((t) => t.name === nom)) return rpcErr(m.id, -32602, "Outil inconnu : " + nom);
      try {
        return rpc(m.id, await appeler(nom, m.params?.arguments || {}, cle));
      } catch (e) {
        return rpc(m.id, echec("Lecture du patrimoine impossible pour le moment. Réessayez dans un instant."));
      }
    }
    default:
      return rpcErr(m.id, -32601, "Méthode non prise en charge : " + m.method);
  }
}

// GET ?statut : permet à l'app d'afficher si le connecteur est actif. Pas de flux SSE.
export async function GET(request) {
  if (new URL(request.url).searchParams.has("statut")) {
    return json({ statut: supabaseReady() ? "actif" : "inactif" }, 200, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  }
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request) {
  if (!supabaseReady()) return json(rpcErr(null, -32000, "Le connecteur FALT n'est pas encore activé."), 503);
  const cle = await verifierCle(request);
  if (!cle) {
    return json(rpcErr(null, -32001, "Clé FALT manquante, invalide ou révoquée. Générez-en une dans FALT, Paramètres, Claude."), 401, {
      "WWW-Authenticate": 'Bearer realm="FALT", error="invalid_token"',
    });
  }
  let body;
  try { body = await request.json(); } catch { return json(rpcErr(null, -32700, "JSON invalide"), 400); }
  const lot = Array.isArray(body), messages = lot ? body : [body];
  if (!messages.length) return json(rpcErr(null, -32600, "Lot vide"), 400);
  const reponses = [];
  for (const m of messages) { const r = await traiter(m, cle); if (r) reponses.push(r); }
  if (!reponses.length) return new Response(null, { status: 202 });
  return json(lot ? reponses : reponses[0]);
}
