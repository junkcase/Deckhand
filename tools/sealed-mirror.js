// Sealed products (boosters, boxes, bundles, precons…): copies Mana Pool's and Card Kingdom's public sealed price lists
// into one file Deckhand can read, matched by product name, and adds today's price to a running history.
// Output: out/sealed/all.json  { as_of: {mp, ck}, products: [ { k, set, name, tcg, mp: [low ¢, market ¢, qty, url], ck: [retail ¢, buylist ¢, buying qty, url] } ] }
//         out/sealed/hist.json { k: [[day, ¢], ...] }   day = days since 1970 (UTC), a point only when the price changes
// The price in the history is the one Deckhand shows first: Mana Pool market, else Mana Pool lowest, else Card Kingdom retail.
const fs = require("fs"), path = require("path");
const MP = "https://manapool.com/api/v1/prices/sealed", CK = "https://api.cardkingdom.com/api/sealed_pricelist", SETS = "https://api.scryfall.com/sets";
const UA = "Deckhand price mirror (github.com/junkcase/Deckhand)";
const KEEP_DAYS = 400;

// one spelling for a product name, so the two stores' names meet ("Commander Deck - Foo" / "Commander Deck: Foo")
const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/['’`".,:()\[\]!?]/g, "").replace(/[-–—/]+/g, " ").replace(/\s+/g, " ").trim();
const cents = v => { const n = Math.round(parseFloat(v) * 100); return Number.isFinite(n) && n > 0 ? n : null; };
const mainPrice = p => (p.mp && (p.mp[1] || p.mp[0])) || (p.ck && p.ck[0]) || null;

function combine(mp, ck, sets) {
  const byName = {}, setOf = {};
  const names = [];
  for (const s of (sets && sets.data) || []) { if (s.digital) continue; const n = norm(s.name); setOf[n] = setOf[n] || s.code; names.push(n); }
  names.sort((a, b) => b.length - a.length);
  // Card Kingdom's edition name isn't always Scryfall's: then the longest set name the product's name starts with
  // ("Modern Horizons 3 Collector's Edition Commander Deck" → Modern Horizons 3)
  const setFor = (edition, name) => { const e = setOf[norm(edition)]; if (e) return e; const n = norm(name) + " "; const hit = names.find(x => x.length >= 4 && n.startsWith(x + " ")); return hit ? setOf[hit] : ""; };
  for (const r of (mp && mp.data) || []) {
    if (r.language_id && r.language_id !== "EN") continue;
    const k = norm(r.name); if (!k) continue;
    byName[k] = { k, set: String(r.set_code || "").toLowerCase(), name: r.name, tcg: r.tcgplayer_product_id || null,
      mp: [Number.isFinite(r.low_price) && r.low_price > 0 ? r.low_price : null, Number.isFinite(r.price_market) && r.price_market > 0 ? r.price_market : null, r.available_quantity || 0, r.url || ""], ck: null };
  }
  for (const r of (ck && ck.data) || []) {
    const k = norm(r.name); if (!k) continue;
    const row = [cents(r.price_retail), cents(r.price_buy), parseInt(r.qty_buying) || 0, r.url ? "https://www.cardkingdom.com/" + String(r.url).replace(/^\//, "") : ""];
    if (row[0] == null && row[1] == null) continue;
    const p = byName[k] || (byName[k] = { k, set: setFor(r.edition, r.name), name: r.name, tcg: null, mp: null, ck: null });
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

async function main() {
  const out = process.argv[2] || "out", dir = path.join(out, "sealed");
  const [mp, ck, sets] = await Promise.all([get(MP).catch(e => (console.error("Mana Pool:", e.message), null)), get(CK).catch(e => (console.error("Card Kingdom:", e.message), null)), get(SETS).catch(() => null)]);
  if (!mp && !ck) throw new Error("both sealed price lists failed; keeping yesterday's copy");
  const products = combine(mp, ck, sets);
  if (products.length < 500) throw new Error(`only ${products.length} products; keeping yesterday's copy`);
  let hist = {}; try { hist = JSON.parse(fs.readFileSync(path.join(dir, "hist.json"), "utf8")); } catch (e) {}
  addHistory(hist, products, Math.floor(Date.now() / 864e5));
  fs.mkdirSync(dir, { recursive: true });
  const as_of = { mp: mp && mp.meta && mp.meta.as_of || null, ck: ck && ck.meta && ck.meta.created_at ? ck.meta.created_at.replace(" ", "T") + "Z" : null };
  fs.writeFileSync(path.join(dir, "all.json"), JSON.stringify({ as_of, products }));
  fs.writeFileSync(path.join(dir, "hist.json"), JSON.stringify(hist));
  const both = products.filter(p => p.mp && p.ck).length;
  console.log(`sealed: ${products.length} products (${both} at both stores, ${products.filter(p => p.mp && !p.ck).length} Mana Pool only, ${products.filter(p => !p.mp && p.ck).length} Card Kingdom only), ${Object.keys(hist).length} with history`);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { combine, addHistory, norm, mainPrice };
