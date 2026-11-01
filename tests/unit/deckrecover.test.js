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
  if (m === "PATCH") { const b = JSON.parse(o.body); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"';
    (g.hist = g.hist || []).unshift({ version: "v" + GH.n, committed_at: new Date(Date.now() + GH.n * 1000).toISOString(), files: JSON.parse(JSON.stringify(g.files)) }); return J(g); }
  const parts = url.pathname.split("/");
  if (parts[3] === "commits") return J((g.hist || []).map(h => ({ version: h.version, committed_at: h.committed_at })));
  if (parts[3]) { const h = (g.hist || []).find(x => x.version === parts[3]); return h ? J({ id: g.id, files: Object.fromEntries(Object.entries(h.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) }) : J({}, 404); }
  if ((o.headers || {})["If-None-Match"] === g.etag) return new Response(null, { status: 304, headers: { ETag: g.etag } });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
async function device(name) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  w.scrollTo = () => {}; w.indexedDB = new IDBFactory();
  Object.assign(w, { CompressionStream, DecompressionStream, Response, TextEncoder });
  w.fetch = async (u, o) => String(u).startsWith("https://api.github.com") ? github(String(u), o) : { ok: false, status: 404, json: async () => ({}) };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,syncSheet,go,closeSheet,undoSync,pickSync,addToDeck,save,findOldDecks,go,render};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}
(async () => {
  const A = await device("computer"), B = await device("tablet");
  A.addToColl(A.slim(sol), "nonfoil", 1, "main");
  await A.connectSync("ghp_good"); await A.sync();
  A.S().decks.gj = { id: "gj", name: "Gjalta EDH", format: "commander", cmdr: [], cards: {}, created: Date.now(), updated: Date.now() };
  A.addToDeck(A.S().decks.gj, A.slim(bolt), 1, false); A.addToDeck(A.S().decks.gj, A.slim(cs), 1, false); A.save();
  await new Promise(r => setTimeout(r, 300)); await A.sync();
  // the tablet already has cards and connects; the dialog now warns what each choice removes
  B.addToColl(B.slim(path), "nonfoil", 2, "main");
  await B.connectSync("ghp_good"); await B.sync();
  const dlg = B.w.document.querySelector("#syBody").textContent;
  ok(/Removes the deck “Gjalta EDH”/.test(dlg), "first sync on another device warns: “Use this tablet's cards everywhere … Removes the deck “Gjalta EDH””");
  B.w.document.querySelector("#syMine").click(); await new Promise(r => setTimeout(r, 400));
  await A.sync();
  ok(!A.S().decks.gj, "(the way a deck can go missing: that choice removed it everywhere)");
  ok((A.S().meta.deckTrash || []).some(x => x.deck.name === "Gjalta EDH" && /sync/.test(x.why)), "…but this computer kept it under Recently deleted (removed by a sync)");
  // recover from GitHub's history on the tablet, which never had it
  const found = await B.findOldDecks();
  ok(found.length === 1 && found[0].deck.name === "Gjalta EDH" && Object.keys(found[0].deck.cards).length === 2, "“Missing a deck?” finds Gjalta EDH (2 cards) in an earlier version of the synced copy");
  B.S().decks.gj = found[0].deck; B.save(); await new Promise(r => setTimeout(r, 300)); await B.sync(); await A.sync();
  ok(A.S().decks.gj && B.S().decks.gj && Object.keys(A.S().decks.gj.cards).length === 2, "restored, and synced back to the computer");
  // deleting a deck yourself: undo + recently deleted
  process.exit();
})();
