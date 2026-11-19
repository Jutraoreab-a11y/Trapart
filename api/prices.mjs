// Cours de marché relayés par le serveur FALT : la clé du fournisseur reste côté serveur.
// Variables d'environnement Vercel :
//   PRICE_PROVIDER  finnhub | fmp | alphavantage   (défaut : finnhub)
//   PRICE_API_KEY   clé du fournisseur pour les actions, ETF et fonds cotés
//   COINGECKO_API_KEY  facultatif (clé « demo » gratuite) pour les crypto-actifs
import { json, sameOrigin } from "../lib/http.mjs";

const TICKER = /^[A-Za-z0-9.\-:^=]{1,20}$/;
const CG_ID = /^[a-z0-9-]{1,60}$/;

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function stockPrice(provider, key, sym) {
  const s = encodeURIComponent(sym), k = encodeURIComponent(key);
  if (provider === "fmp") {
    const j = await getJson(`https://financialmodelingprep.com/stable/quote?symbol=${s}&apikey=${k}`);
    return Array.isArray(j) && j[0] ? j[0].price : null;
  }
  if (provider === "alphavantage") {
    const j = await getJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${s}&apikey=${k}`);
    if (j.Note || j.Information) throw new Error("quota");
    return j["Global Quote"] ? parseFloat(j["Global Quote"]["05. price"]) : null;
  }
  const j = await getJson(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${k}`);
  return j && j.c ? j.c : null;
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Origine non autorisée" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const stocks = [...new Set((body.stocks || []).map(String).map(s => s.trim()).filter(s => TICKER.test(s)))].slice(0, 40);
  const cryptos = [...new Set((body.cryptos || []).map(String).map(s => s.trim()).filter(s => CG_ID.test(s)))].slice(0, 40);
  const out = { stocks: {}, cryptos: {}, missing: [], notes: [] };

  const provider = (process.env.PRICE_PROVIDER || "finnhub").toLowerCase();
  const key = process.env.PRICE_API_KEY || "";
  if (stocks.length && !key) out.notes.push("source des cours actions non configurée");
  if (stocks.length && key) {
    for (const sym of stocks) {
      try {
        const p = await stockPrice(provider, key, sym);
        if (p > 0) out.stocks[sym] = p; else out.missing.push(sym);
      } catch (e) {
        if (e.message === "quota") { out.notes.push("quota du fournisseur atteint"); break; }
        out.missing.push(sym);
      }
    }
  }
  if (cryptos.length) {
    try {
      const h = process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {};
      const j = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptos.join(",")}&vs_currencies=eur`, h);
      cryptos.forEach(id => { const p = j[id] && j[id].eur; if (p) out.cryptos[id] = p; else out.missing.push(id); });
    } catch { out.notes.push("cours crypto indisponibles pour le moment"); }
  }
  return json(out, 200, { "Cache-Control": "private, max-age=60" });
}
