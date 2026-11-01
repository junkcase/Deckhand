const { JSDOM } = require("jsdom"); const fs = require("fs");
const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const idbShared = new IDBFactory();
// realistic Scryfall card objects
const U = 3100, cards = [];
for (let i = 0; i < U; i++) { const id = `${(1e7 + i).toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-${(1e11 + i).toString(16).padStart(12, "0")}`;
  cards.push({ id, oracle_id: "or-" + id, name: "Card Name Number " + i, set: "s" + (i % 40), set_name: "Some Long Set Name " + (i % 40), collector_number: String(i), rarity: "rare", type_line: "Legendary Creature — Human Wizard", cmc: 3, mana_cost: "{1}{U}{U}", colors: ["U"], color_identity: ["U"],
    prices: { usd: (1 + (i % 50)).toFixed(2), usd_foil: (3 + (i % 60)).toFixed(2), usd_etched: null, eur: "1.00", eur_foil: "2.00", tix: "0.02" }, finishes: ["nonfoil", "foil"], lang: "en",
    legalities: { standard: "not_legal", pioneer: "legal", modern: "legal", legacy: "legal", vintage: "legal", pauper: "not_legal", commander: "legal" },
    image_uris: { small: `https://cards.scryfall.io/small/front/${id[0]}/${id[1]}/${id}.jpg?1690000000`, normal: `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg?1690000000` }, scryfall_uri: `https://scryfall.com/card/s/${i}/card-name-number-${i}?utm_source=api` }); }
// ManaBox-style CSV: 3100 unique printings, quantities summing to 6424
let rows = [], total = 0;
for (let i = 0; i < U; i++) { const q = i < 224 ? 3 : 2; total += q; rows.push(`My Binder,binder,${cards[i].name},${cards[i].set.toUpperCase()},${cards[i].set_name},${i},${i % 7 ? "normal" : "foil"},rare,${q},${i},${cards[i].id},1.0,false,false,near_mint,en,USD`); }
rows = rows.slice(0, U); total = rows.reduce((a, r) => a + +r.split(",")[8], 0);
const csv = "Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency\n" + rows.join("\n");
function quotaLS(limitChars) {   // localStorage that fails like a phone's (about 5 MB)
  const m = new Map(); const used = () => [...m].reduce((a, [k, v]) => a + k.length + v.length, 0);
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { v = String(v); const old = m.get(k) || ""; if (used() - old.length + v.length > limitChars) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } m.set(k, v); }, removeItem: k => m.delete(k), _m: m };
}
async function page(ls, withIdb = true) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  w.scrollTo = () => {}; Object.defineProperty(w, "localStorage", { value: ls, configurable: true });
  if (withIdb) w.indexedDB = idbShared; else delete w.indexedDB;
  w.fetch = async (u, o) => { u = String(u); const J = j => ({ ok: true, status: 200, json: async () => j });
    if (u.endsWith("/cards/collection")) { const ids = JSON.parse(o.body).identifiers; return J({ data: ids.map(i => cards.find(c => i.id ? c.id === i.id : c.set === i.set && c.collector_number === i.collector_number)).filter(Boolean), not_found: [] }); }
    return { ok: false, status: 404, json: async () => ({}) }; };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,csvImport,collTotals,flushSave,boot:()=>boot};");
  await new Promise(r => setTimeout(r, 300));     // let boot() load
  return w;
}
async function doImport(w, replace) {
  const $ = s => w.document.querySelector(s);
  await w.T.csvImport({ name: "ManaBox_Collection.csv", text: async () => csv }, { kind: "coll" });
  if (replace) { const c = $("#impRepl"); c.checked = true; c.dispatchEvent(new w.Event("change")); }
  $("#impGo").click();
  for (let i = 0; i < 1200 && !$("#impDone"); i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 400));
  return $("#impRes").textContent.replace(/\s+/g, " ");
}
(async () => {
  const ls = quotaLS(5.2e6);
  // 1. size check: how big is this collection as text?
  let w = await page(ls);
  let res = await doImport(w, false);
  const json = JSON.stringify(w.T.S()).length;
  console.log(`   collection of ${total.toLocaleString()} cards = ${(json / 1e6).toFixed(1)} million characters (phone localStorage limit is about 5)`);
  ok(json > 5e6 * 0.6, "a collection this size crowds or overflows the old storage");
  ok(w.T.collTotals("all").cards === total, `imported ${w.T.collTotals("all").cards.toLocaleString()} of ${total.toLocaleString()} cards`);
  // 2. reload: everything still there?
  w = await page(ls);
  ok(w.T.collTotals("all").cards === total, `after reopening the app: ${w.T.collTotals("all").cards.toLocaleString()} cards (all kept)`);
  ok(!ls.getItem("deckhand.v1"), "nothing big left in localStorage");
  // 3. re-import with Replace: no doubling, then undo
  res = await doImport(w, true);
  ok(w.T.collTotals("all").cards === total, `replace re-import: ${w.T.collTotals("all").cards.toLocaleString()} cards, not doubled`);
  ok(/Undo, put my old collection back/.test(res), "offers undo after replacing");
  w = await page(ls); ok(w.T.collTotals("all").cards === total, "replace result survives reopening");
  // 4. without Replace it adds on top (as before)
  res = await doImport(w, false); ok(w.T.collTotals("all").cards === total * 2, "plain import still adds on top");
  // 5. older data in localStorage moves into the database
  const ls2 = quotaLS(5.2e6); ls2.setItem("deckhand.v1", JSON.stringify({ coll: { "x|nonfoil|main": { id: "x", oid: "o", name: "Old Card", set: "abc", setName: "A", num: "1", type: "Artifact", img: "", prices: { usd: "2.00" }, finishes: ["nonfoil"], finish: "nonfoil", qty: 3, binder: "main", added: 1 } }, decks: {}, meta: {}, binders: { main: { id: "main", name: "Collection" } } }));
  const idbOld = new IDBFactory();
  const dom2 = await (async () => { const d = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const ww = d.window; ww.scrollTo = () => {}; Object.defineProperty(ww, "localStorage", { value: ls2 }); ww.indexedDB = idbOld; ww.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) }); ww.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,collTotals};"); await new Promise(r => setTimeout(r, 300)); return ww; })();
  ok(dom2.T.collTotals("all").cards === 3 && !ls2.getItem("deckhand.v1"), "existing saved cards move over to the new storage");
})();
