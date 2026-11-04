// "Missing a deck?" with a long history: hundreds of versions, the deck only present for a few hours days ago.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const N = 520, now = Date.now(), H = 36e5, versions = [];
for (let i = 0; i < N; i++) versions.push({ version: "v" + i, committed_at: new Date(now - i * (240 / N) * H).toISOString() });   // 520 versions over 10 days, newest first
const inWindow = i => { const age = i * (240 / N); return age > 170 && age < 176; };                                                    // Eluge existed for ~6 hours, 7 days ago
const deck = (id, name) => ({ id, name, format: "commander", cmdr: [], cards: { "x|0": { id: "x", name: "Sol Ring", qty: 1, side: false } }, created: 1, updated: 1 });
let fetched = 0;
async function github(u) {
  const url = new URL(u), J = j => new Response(JSON.stringify(j), { status: 200, headers: { "Content-Type": "application/json" } });
  const p = url.pathname.split("/");
  if (p[3] === "commits") { const page = +url.searchParams.get("page") || 1, per = +url.searchParams.get("per_page") || 30; return J(versions.slice((page - 1) * per, page * per)); }
  const i = +p[3].slice(1); fetched++;
  const decks = { k: deck("k", "Kiora") }; if (inWindow(i)) decks.e = deck("e", "Eluge");
  return J({ id: "g", files: { "deckhand-sync.json": { content: JSON.stringify({ v: 1, chunks: 1, device: "tablet" }) }, "deckhand-data-0.txt": { content: "J" + JSON.stringify({ coll: {}, decks }) } } });
}
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  w.scrollTo = () => {}; w.indexedDB = new IDBFactory(); Object.assign(w, { Response });
  w.fetch = async u => String(u).startsWith("https://api.github.com") ? github(String(u)) : { ok: false, status: 404, json: async () => ({}) };
  w.localStorage.setItem("deckhand.sync", JSON.stringify({ token: "t", gist: "g", login: "me", paused: true }));
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,findOldDecks,save};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.S().decks.k = deck("k", "Kiora");
  const t0 = Date.now(), res = await T.findOldDecks(null, 80);
  ok(res.total === N, `lists every synced version (${res.total}), not just the newest 40`);
  ok(res.map(x => x.deck.name).includes("Eluge"), `finds a deck that only existed for a few hours a week ago (checked ${res.checked} versions, ${fetched} downloads, ${Date.now() - t0} ms)`);
  ok(res.checked === 80 && fetched === 80, "checks 80 versions spread across the history in one go");
  const res2 = await T.findOldDecks(null, 80);
  ok(res2.checked === 160 && fetched === 160 && res2.map(x => x.deck.name).includes("Eluge"), "Keep looking checks 80 different versions and keeps what it found");
  process.exit();
})();
