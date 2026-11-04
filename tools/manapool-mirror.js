// Copies Mana Pool's public price list into small files Deckhand can read.
// Mana Pool's API doesn't allow other websites to read it from the browser, so a GitHub Action runs this once a day
// and publishes the result on the repo's "data" branch (read through raw.githubusercontent.com, which allows it).
// Output: out/manapool/meta.json and out/manapool/<2 hex chars>.json, keyed by Scryfall ID:
//   id: [lowest listing ¢, lowest NM ¢, lowest foil ¢, lowest etched ¢, "set/number/slug" on manapool.com/card/]
const fs = require("fs"), path = require("path");
const SRC = "https://manapool.com/api/v1/prices/singles";
function convert(j) {
  if (!j || !Array.isArray(j.data)) throw new Error("unexpected response: no data list");
  const shards = {}; let n = 0;
  const base = ((j.meta && j.meta.base_url) || "https://manapool.com").replace(/\/$/, "");
  for (const r of j.data) {
    const id = String(r.scryfall_id || "").toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) continue;
    const num = v => Number.isFinite(v) && v > 0 ? Math.round(v) : null;
    const row = [num(r.price_cents), num(r.price_cents_nm), num(r.price_cents_foil), num(r.price_cents_etched)];
    if (row.every(v => v == null)) continue;                        // nothing listed
    let p = String(r.url || ""); if (p.startsWith(base)) p = p.slice(base.length); p = p.replace(/^\/card\//, "");
    if (!/^[a-z0-9][a-z0-9._-]*\/[^/?#\s]+\/[a-z0-9-]+$/i.test(p)) p = "";
    row.push(p);
    (shards[id.slice(0, 2)] = shards[id.slice(0, 2)] || {})[id] = row; n++;
  }
  return { meta: { as_of: (j.meta && j.meta.as_of) || new Date().toISOString(), cards: n, source: "Mana Pool (manapool.com)", base: base + "/card/" }, shards };
}
async function main() {
  const out = process.argv[2] || "out";
  const r = await fetch(SRC, { headers: { Accept: "application/json", "User-Agent": "Deckhand price mirror (github.com/junkcase/Deckhand)" } });
  if (!r.ok) throw new Error("Mana Pool returned " + r.status);
  const { meta, shards } = convert(await r.json());
  if (meta.cards < 10000) throw new Error(`only ${meta.cards} priced cards; keeping yesterday's copy`);
  const dir = path.join(out, "manapool"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(dir, k + ".json"), JSON.stringify(v));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  console.log(`wrote ${meta.cards} cards in ${Object.keys(shards).length} files, prices as of ${meta.as_of}`);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { convert };
