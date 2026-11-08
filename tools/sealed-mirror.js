// Sealed products (boosters, boxes, bundles, precons…): copies TCGplayer's sealed prices (through TCGCSV, a daily copy of
// TCGplayer's own price data), Mana Pool's and Card Kingdom's public sealed price lists into one file Deckhand can read,
// and adds today's price to a running history. TCGplayer and Mana Pool meet by TCGplayer's product number; Card Kingdom by name.
// Output: out/sealed/all.json  { as_of: {tp, mp, ck}, products: [ { k, set, name, tcg, upc, tp: [market ¢, low ¢, mid ¢, url],
//           mp: [low ¢, market ¢, qty, url], ck: [retail ¢, buylist ¢, buying qty, url] } ] }
//         out/sealed/hist.json { k: [[day, ¢], ...] }   day = days since 1970 (UTC), a point only when the price changes
// The price in the history is the one Deckhand shows first: TCGplayer market, else Mana Pool market, else Mana Pool lowest, else Card Kingdom,
// else TCGplayer's lowest listing.
const fs = require("fs"), path = require("path");
const TCSV = "https://tcgcsv.com/tcgplayer/1", MP = "https://manapool.com/api/v1/prices/sealed", CK = "https://api.cardkingdom.com/api/sealed_pricelist", SETS = "https://api.scryfall.com/sets";
const UA = "Deckhand price mirror (github.com/junkcase/Deckhand)";
const KEEP_DAYS = 400;

// one spelling for a product name, so the two stores' names meet ("Commander Deck - Foo" / "Commander Deck: Foo")
// (TCGplayer says "Booster Display" where the stores say "Booster Box")
const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/['’`".,:()\[\]!?]/g, "").replace(/[-–—/]+/g, " ").replace(/\s+/g, " ").trim().replace(/\bbooster display\b/g, "booster box");
const cents = v => { const n = Math.round(parseFloat(v) * 100); return Number.isFinite(n) && n > 0 ? n : null; };
const mainPrice = p => (p.tp && p.tp[0]) || (p.mp && (p.mp[1] || p.mp[0])) || (p.ck && p.ck[0]) || (p.tp && p.tp[1]) || null;

// tp: TCGplayer sealed products [{ id, name, abbr, group, url, upc, market, low, mid }] (dollars), or null
function combine(mp, ck, sets, tp) {
  const byName = {}, setOf = {}, byTcg = {}, codes = new Set();
  const names = [];
  for (const s of (sets && sets.data) || []) { codes.add(s.code); if (s.digital) continue; const n = norm(s.name); setOf[n] = setOf[n] || s.code; names.push(n); }
  names.sort((a, b) => b.length - a.length);
  // Card Kingdom's edition name isn't always Scryfall's: then the longest set name the product's name starts with
  // ("Modern Horizons 3 Collector's Edition Commander Deck" → Modern Horizons 3)
  const setFor = (edition, name) => { const e = setOf[norm(edition)]; if (e) return e; const n = norm(name) + " "; const hit = names.find(x => x.length >= 4 && n.startsWith(x + " ")); return hit ? setOf[hit] : ""; };
  for (const r of (mp && mp.data) || []) {
    if (r.language_id && r.language_id !== "EN") continue;
    const k = norm(r.name); if (!k) continue;
    byName[k] = { k, set: String(r.set_code || "").toLowerCase(), name: r.name, tcg: r.tcgplayer_product_id || null,
      tp: null, mp: [Number.isFinite(r.low_price) && r.low_price > 0 ? r.low_price : null, Number.isFinite(r.price_market) && r.price_market > 0 ? r.price_market : null, r.available_quantity || 0, r.url || ""], ck: null };
    if (byName[k].tcg) byTcg[byName[k].tcg] = byName[k];
  }
  for (const r of tp || []) {
    const row = [cents(r.market), cents(r.low), cents(r.mid), /^https:\/\/www\.tcgplayer\.com\//.test(r.url || "") ? r.url : ""];
    if (row[0] == null && row[1] == null) continue;
    let p = byTcg[r.id];
    if (!p) { const k = norm(r.name); if (!k) continue;
      const ab = String(r.abbr || "").toLowerCase();
      p = byName[k] || (byName[k] = { k, set: codes.has(ab) ? ab : setFor(r.group, r.name), name: r.name, tcg: r.id, tp: null, mp: null, ck: null });
      byTcg[r.id] = p; if (!p.tcg) p.tcg = r.id; }
    p.tp = row; if (r.upc && /^\d{8,14}$/.test(r.upc)) p.upc = r.upc;
  }
  for (const r of (ck && ck.data) || []) {
    const k = norm(r.name); if (!k) continue;
    const row = [cents(r.price_retail), cents(r.price_buy), parseInt(r.qty_buying) || 0, r.url ? "https://www.cardkingdom.com/" + String(r.url).replace(/^\//, "") : ""];
    if (row[0] == null && row[1] == null) continue;
    const p = byName[k] || (byName[k] = { k, set: setFor(r.edition, r.name), name: r.name, tcg: null, tp: null, mp: null, ck: null });
    p.ck = row;
  }
  return Object.values(byName).filter(p => mainPrice(p) || (p.ck && p.ck[1])).sort((a, b) => a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
}

function addHistory(hist, products, day) {
  const live = new Set();
  for (const p of products) {
    const c = mainPrice(p); live.add(p.k); if (!c) continue;
    const pts = hist[p.k] || (hist[p.k] = []), last = pts[pts.length - 1];
    if (last && last[0] === day) last[1] = c;
    else if (!last || Math.abs(c - last[1]) >= Math.max(1, last[1] * 0.01)) pts.push([day, c]);
  }
  for (const [k, pts] of Object.entries(hist)) {
    while (pts.length > 1 && pts[1][0] <= day - KEEP_DAYS) pts.shift();
    if (!live.has(k) && pts.length && pts[pts.length - 1][0] < day - KEEP_DAYS) delete hist[k];
  }
  return hist;
}

async function get(url, accept = "application/json") {
  const r = await fetch(url, { headers: { Accept: accept, "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}

// TCGplayer's sealed products and prices, set by set, from TCGCSV (about a day old; no key needed)
async function fetchTcg() {
  const groups = (await get(TCSV + "/groups")).results || [], out = [];
  let failed = 0;
  for (const g of groups) {
    try {
      const [pd, pr] = await Promise.all([get(`${TCSV}/${g.groupId}/products`), get(`${TCSV}/${g.groupId}/prices`)]);
      const price = {}; for (const x of pr.results || []) if (!price[x.productId] || x.subTypeName === "Normal") price[x.productId] = x;
      for (const x of pd.results || []) {
        const ext = x.extendedData || []; if (ext.some(e => e.name === "Rarity" || e.name === "Number")) continue;      // a card, not sealed
        const pz = price[x.productId]; if (!pz) continue;
        const upc = (ext.find(e => e.name === "UPC") || {}).value;
        out.push({ id: x.productId, name: x.name, abbr: g.abbreviation, group: g.name, url: x.url, upc: upc ? String(upc).replace(/\D/g, "") : "", market: pz.marketPrice, low: pz.lowPrice, mid: pz.midPrice });
      }
    } catch (e) { failed++; }
    await new Promise(r => setTimeout(r, 100));
  }
  if (failed > groups.length / 4) throw new Error(`${failed} of ${groups.length} sets failed`);
  console.log(`TCGplayer: ${out.length} sealed products from ${groups.length} sets${failed ? `, ${failed} sets failed` : ""}`);
  return out;
}

async function main() {
  const out = process.argv[2] || "out", dir = path.join(out, "sealed");
  const [mp, ck, sets] = await Promise.all([get(MP).catch(e => (console.error("Mana Pool:", e.message), null)), get(CK).catch(e => (console.error("Card Kingdom:", e.message), null)), get(SETS).catch(() => null)]);
  const tp = await fetchTcg().catch(e => (console.error("TCGplayer (TCGCSV):", e.message), null));
  if (!mp && !ck && !tp) throw new Error("both sealed price lists failed; keeping yesterday's copy");
  const products = combine(mp, ck, sets, tp);
  if (products.length < 500) throw new Error(`only ${products.length} products; keeping yesterday's copy`);
  let hist = {}; try { hist = JSON.parse(fs.readFileSync(path.join(dir, "hist.json"), "utf8")); } catch (e) {}
  addHistory(hist, products, Math.floor(Date.now() / 864e5));
  fs.mkdirSync(dir, { recursive: true });
  const as_of = { tp: tp ? new Date().toISOString() : null, mp: mp && mp.meta && mp.meta.as_of || null, ck: ck && ck.meta && ck.meta.created_at ? ck.meta.created_at.replace(" ", "T") + "Z" : null };
  fs.writeFileSync(path.join(dir, "all.json"), JSON.stringify({ as_of, products }));
  fs.writeFileSync(path.join(dir, "hist.json"), JSON.stringify(hist));
  const both = products.filter(p => p.mp && p.ck).length;
  console.log(`sealed: ${products.length} products (${products.filter(p => p.tp).length} with TCGplayer prices, ${both} at both Mana Pool and Card Kingdom, ${products.filter(p => p.mp && !p.ck).length} Mana Pool only, ${products.filter(p => !p.mp && p.ck).length} Card Kingdom only), ${Object.keys(hist).length} with history`);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { combine, addHistory, norm, mainPrice };
