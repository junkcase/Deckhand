const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
const C = (o) => Object.assign({ oracle_id: "o" + o.name, set_name: "S", rarity: "rare", type_line: "Creature", finishes: ["nonfoil", "foil"], image_uris: { small: "s", normal: "n" }, lang: "en" }, o);
const cards = [
  C({ id: "ja1", name: "Sheoldred, the Apocalypse", set: "dmu", collector_number: "107", lang: "ja", prices: { usd: null, usd_foil: null } }),
  C({ id: "en1", name: "Sheoldred, the Apocalypse", set: "dmu", collector_number: "107", prices: { usd: "75.00", usd_foil: "90.00" } }),
  C({ id: "de1", name: "Ragavan, Nimble Pilferer", set: "mh2", collector_number: "138", lang: "de", prices: { usd: null } }),
  C({ id: "en2", name: "Ragavan, Nimble Pilferer", set: "mh2", collector_number: "138", prices: { usd: "50.00", usd_foil: "70.00" } }),
  C({ id: "bolt", name: "Lightning Bolt", set: "2x2", collector_number: "117", prices: { usd: "1.00", usd_foil: "4.00" } }),
  C({ id: "tok", name: "Treasure", set: "tdmu", collector_number: "9", prices: { usd: null } }),
];
w.fetch = async (u, o) => { u = String(u); const J = j => ({ ok: true, status: 200, json: async () => j });
  if (u.endsWith("/cards/collection")) { const ids = JSON.parse(o.body).identifiers;
    const data = ids.map(i => i.id ? cards.find(c => c.id === i.id) : i.collector_number ? cards.find(c => c.set === i.set && c.collector_number === i.collector_number && c.lang === "en") : cards.find(c => c.name === i.name && c.lang === "en")).filter(Boolean);
    return J({ data, not_found: [] }); }
  return { ok: false, status: 404, json: async () => ({}) }; };
w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,refreshPrices,collTotals,valueSheet,go};");
const T = w.T, $ = s => w.document.querySelector(s);
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const by = id => T.slim(cards.find(c => c.id === id));
T.addToColl(by("ja1"), "nonfoil", 2, "main"); T.addToColl(by("de1"), "foil", 1, "main"); T.addToColl(by("bolt"), "nonfoil", 4, "main");
T.addToColl(by("tok"), "nonfoil", 3, "main"); T.addToColl(by("en1"), "nonfoil", 1, "wish");
ok(T.collTotals("all").value === 4, "before: foreign cards count as $0, total $" + T.collTotals("all").value);
(async () => {
  await T.refreshPrices(false);
  const v = T.collTotals("all").value;
  ok(v === 2 * 75 + 70 + 4, "after update: Japanese + German cards priced from English printing, total $" + v);
  const ja = Object.values(T.S().coll).find(e => e.id === "ja1");
  ok(ja.priceFrom === "en" && ja.lang === "ja", "marked as 'priced from English'");
  await T.refreshPrices(false);
  ok(T.collTotals("all").value === v, "a second update keeps the same total (no drift)");
  T.go("coll"); const list = $("#clist").textContent;
  ok(/JA · EN price/.test(list) && /No price/.test(list), "list labels EN-priced and unpriced cards");
  T.valueSheet(); const t = $("#sheetRoot").textContent.replace(/\s+/g, " ");
  console.log("   text:", t.slice(0, 420));
  ok(/Counted ?\$224\.00/.test(t) && /Wishlist wishlist · not counted/.test(t), "breakdown shows counted total and excluded wishlist");
  ok(/3 cards have no price on Scryfall/.test(t) && /3× Treasure/.test(t), "breakdown lists $0 cards");
  ok(/3 non-English or special cards are priced using their English printing \(\$220\.00\)/.test(t), "breakdown explains English-priced cards");
})();
