// Copies Card Kingdom's public price list (with its buylist) into small files Deckhand can read, like the Mana Pool copy.
// Output: out/cardkingdom/meta.json and out/cardkingdom/<2 hex chars>.json, keyed by Scryfall ID:
//   id: [buy ¢ normal, buy ¢ foil, how many they're buying normal, foil, "mtg/set/card" on cardkingdom.com]
const fs = require("fs"), path = require("path");
const SRC = "https://api.cardkingdom.com/api/v2/pricelist";
function convert(j) {
  if (!j || !Array.isArray(j.data)) throw new Error("unexpected response: no data list");
  const by = {}; let n = 0;
  for (const r of j.data) {
    const id = String(r.scryfall_id || "").toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) continue;
    const foil = r.is_foil === true || r.is_foil === "true", buy = Math.round(parseFloat(r.price_buy) * 100), qty = parseInt(r.qty_buying) || 0;
    const row = by[id] || (by[id] = [null, null, 0, 0, ""]);
    if (Number.isFinite(buy) && buy > 0) { row[foil ? 1 : 0] = buy; row[foil ? 3 : 2] = qty; }
    const u = String(r.url || ""); if (!row[4] && !foil && /^mtg\/[a-z0-9-]+\/[a-z0-9-]+$/i.test(u)) row[4] = u;
  }
  const shards = {};
  for (const [id, row] of Object.entries(by)) { if (row[0] == null && row[1] == null) continue; (shards[id.slice(0, 2)] = shards[id.slice(0, 2)] || {})[id] = row; n++; }
  return { meta: { as_of: (j.meta && j.meta.created_at) ? j.meta.created_at.replace(" ", "T") + "Z" : new Date().toISOString(), cards: n, source: "Card Kingdom (cardkingdom.com)", base: "https://www.cardkingdom.com/" }, shards };
}
async function main() {
  const out = process.argv[2] || "out";
  const r = await fetch(SRC, { headers: { Accept: "application/json", "User-Agent": "Deckhand price mirror (github.com/junkcase/Deckhand)" } });
  if (!r.ok) throw new Error("Card Kingdom returned " + r.status);
  const { meta, shards } = convert(await r.json());
  if (meta.cards < 10000) throw new Error(`only ${meta.cards} cards; keeping yesterday's copy`);
  const dir = path.join(out, "cardkingdom"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(dir, k + ".json"), JSON.stringify(v));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  console.log(`wrote ${meta.cards} cards in ${Object.keys(shards).length} files, prices as of ${meta.as_of}`);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { convert };
