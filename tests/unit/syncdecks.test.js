const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name, set, num) => ({ id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const sol = P("sol", "Sol Ring", "cmm", "1"), bolt = P("bolt", "Lightning Bolt", "2x2", "2"), cs = P("cs", "Counterspell", "mh2", "3"), path = P("path", "Path to Exile", "con", "4");
// ---- a fake GitHub
const GH = { gists: {}, n: 0, calls: [], token: "ghp_good" };
async function github(u, o = {}) {
  const url = new URL(u), m = (o.method || "GET").toUpperCase(), auth = (o.headers || {}).Authorization;
  GH.calls.push(m + " " + url.pathname);
  const J = (j, st = 200, h = {}) => new Response(JSON.stringify(j), { status: st, headers: Object.assign({ "Content-Type": "application/json" }, h) });
  if (auth !== "token " + GH.token) return J({ message: "Bad credentials" }, 401);
  if (url.pathname === "/user") return J({ login: "junkcase" });
  if (url.pathname === "/gists" && m === "GET") return J(Object.values(GH.gists).map(g => ({ id: g.id, description: g.description })));
  if (url.pathname === "/gists" && m === "POST") { const b = JSON.parse(o.body), id = "g" + (++GH.n); GH.gists[id] = { id, description: b.description, files: b.files, etag: '"e' + GH.n + '"' }; return J(GH.gists[id], 201); }
  const g = GH.gists[url.pathname.split("/")[2]]; if (!g) return J({}, 404);
  if (m === "PATCH") { const b = JSON.parse(o.body); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"'; return J(g); }
  if ((o.headers || {})["If-None-Match"] === g.etag) return new Response(null, { status: 304, headers: { ETag: g.etag } });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
async function device(name) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  w.scrollTo = () => {}; w.indexedDB = new IDBFactory();
  Object.assign(w, { CompressionStream, DecompressionStream, Response, TextEncoder });
  w.fetch = async (u, o) => String(u).startsWith("https://api.github.com") ? github(String(u), o) : { ok: false, status: 404, json: async () => ({}) };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,syncSheet,go,closeSheet,undoSync,pickSync,addToDeck,save};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}
(async () => {
  const A = await device("tablet"), B = await device("phone");
  A.addToColl(A.slim(sol), "nonfoil", 2, "main");
  await A.connectSync("ghp_good"); await A.sync(); await B.connectSync("ghp_good"); await B.sync();
  // a deck built on the tablet after both are connected, the way the app does it
  A.S().decks.k1 = { id: "k1", name: "Krenko Goblins", format: "commander", cmdr: [], cards: {}, created: Date.now(), updated: Date.now() }; A.addToDeck(A.S().decks.k1, A.slim(sol), 1, false); A.S().decks.k1.themes = ["Goblins"]; A.save();
  await new Promise(r => setTimeout(r, 300)); await A.sync(); await B.sync();
  const bd = B.S().decks.k1;
  ok(bd && bd.name === "Krenko Goblins" && Object.keys(bd.cards).length === 1 && bd.themes[0] === "Goblins", "deck made on the tablet shows on the phone with its cards and theme");
  B.addToDeck(B.S().decks.k1, B.slim(bolt), 1, false); B.S().decks.k1.name = "Krenko!"; B.save();
  await new Promise(r => setTimeout(r, 300)); await B.sync(); await A.sync();
  const ad = A.S().decks.k1;
  ok(ad.name === "Krenko!" && Object.keys(ad.cards).length === 2, "change on the phone (card added, renamed) reaches the tablet");
  // the automatic background sync (no manual button): a few seconds after the change
  A.addToDeck(A.S().decks.k1, A.slim(cs), 1, false);
  await new Promise(r => setTimeout(r, 7000)); await B.sync();
  ok(Object.keys(B.S().decks.k1.cards).length === 3, "a deck change syncs on its own a few seconds later");
  delete A.S().decks.k1; A.save(); await new Promise(r => setTimeout(r, 300)); await A.sync(); await B.sync();
  ok(!B.S().decks.k1, "deleting the deck on one device removes it on the other");
  process.exit();
})();
