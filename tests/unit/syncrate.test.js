// GitHub saying 403: rate limits (wait and retry by itself, cards kept), a token without gist permission (clear message),
// and automatic uploads spaced out so a scanning session doesn't trigger the limit.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name) => ({ id, oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: id, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "https://cards.scryfall.io/small/x.jpg", normal: "https://cards.scryfall.io/normal/x.jpg" } });
const sol = P("sol", "Sol Ring"), bolt = P("bolt", "Lightning Bolt"), kiora = P("kio", "Kiora, the Crashing Wave"), cs = P("cs", "Counterspell");
const GH = { gists: {}, n: 0, token: "ghp_good", failPatch: 0 };
async function github(u, o = {}) {
  const url = new URL(u), m = (o.method || "GET").toUpperCase();
  const J = (j, st = 200, h = {}) => new Response(JSON.stringify(j), { status: st, headers: Object.assign({ "Content-Type": "application/json" }, h) });
  if ((o.headers || {}).Authorization !== "token " + GH.token) return J({ message: "Bad credentials" }, 401);
  if (url.pathname === "/user") return J({ login: "junkcase" });
  if (url.pathname === "/gists" && m === "GET") return J(Object.values(GH.gists).map(g => ({ id: g.id, description: g.description })));
  if (url.pathname === "/gists" && m === "POST") { const b = JSON.parse(o.body), id = "g" + (++GH.n); GH.gists[id] = { id, description: b.description, files: b.files, etag: '"e' + GH.n + '"' }; return J(GH.gists[id], 201); }
  const g = GH.gists[url.pathname.split("/")[2]]; if (!g) return J({}, 404);
  if (m === "PATCH") GH.patches = (GH.patches || 0) + 1;
  if (m === "PATCH" && GH.limit) { const L = GH.limit; GH.limit = null; return J({ message: L.msg }, 403, L.h); }
  if (m === "PATCH") { if (GH.failPatch > 0) { GH.failPatch--; return J({ message: "Server Error" }, 502); } const b = JSON.parse(o.body); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"'; return J(g); }
  if ((o.headers || {})["If-None-Match"] === g.etag) return new Response(null, { status: 304, headers: { ETag: g.etag } });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
// a device = a browser profile (its IndexedDB and localStorage survive closing the page)
function profile() { const m = new Map(); return { idb: new IDBFactory(), ls: { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } } }; }
async function open(name, prof) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/", userAgent: name === "phone" ? "Mozilla/5.0 (Linux; Android 14; Pixel) Mobile" : "Mozilla/5.0 (Windows NT 10.0)" }); const w = dom.window;
  w.scrollTo = () => {}; w.indexedDB = prof.idb; Object.defineProperty(w, "localStorage", { value: prof.ls, configurable: true });
  Object.assign(w, { CompressionStream, DecompressionStream, Response, TextEncoder });
  w.fetch = async (u, o) => String(u).startsWith("https://api.github.com") ? github(String(u), o) : { ok: false, status: 404, json: async () => ({}) };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,PUSH_GAP,pushGap,addToColl,slim,connectSync,syncNow,SYNC,addToDeck,save,flushSave,takeCopies,deleteDeck:typeof deleteDeck==='function'?deleteDeck:null};");
  await new Promise(r => setTimeout(r, 400));
  const T = w.T; T.w = w; T.dom = dom;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0].replace(",", "")}×${e.qty}`).sort().join(", ");
  T.decks = () => Object.values(T.S().decks).map(d => d.name).sort().join(", ");
  T.sync = async () => { for (let i = 0; i < 200 && T.SYNC.busy; i++) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  T.close = () => dom.window.close();             // the tab is closed or the phone kills the page: pending timers never run
  return T;
}
const deck = (T, id, name, card) => { const d = T.S().decks[id] = { id, name, format: "commander", cmdr: [], cards: {}, created: Date.now(), updated: Date.now() }; T.addToDeck(d, T.slim(card), 1, false); T.save(); };
const settle = () => new Promise(r => setTimeout(r, 400));
(async () => {
  const pc = profile(), ph = profile();
  const D = await open("computer", pc);
  D.addToColl(D.slim(sol), "nonfoil", 1, "main"); await settle();
  await D.connectSync("ghp_good"); await D.sync();
  const remoteCards = async () => { const F = await open("phone", ph); if (!F.SYNC.cfg) await F.connectSync("ghp_good"); await F.sync(); await settle(); const c = F.cards(); F.close(); return c; };

  // ---- 1. GitHub's secondary rate limit (403 + retry-after)
  GH.limit = { msg: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.", h: { "retry-after": "60" } };
  D.addToColl(D.slim(bolt), "nonfoil", 2, "main"); await settle(); await D.sync();
  ok(/limiting how often Deckhand can save/.test(D.SYNC.err) && /try again by/.test(D.SYNC.err), `friendly message instead of "GitHub returned 403" (${D.SYNC.err})`);
  ok(D.SYNC.holdUntil > Date.now() + 50e3 && D.SYNC.holdUntil < Date.now() + 70e3, "waits the minute GitHub asked for");
  ok(D.cards() === "Lightning×2, Sol×1" && D.SYNC.dirty, "the cards stay on this computer, marked to upload");
  let n = GH.patches; await D.syncNow(); ok(GH.patches === n, "automatic syncs don't retry before GitHub's time is up");
  D.SYNC.holdUntil = Date.now() - 1; D.SYNC.lastPush = 0; await D.syncNow(); for (let i = 0; i < 100 && D.SYNC.busy; i++) await new Promise(r => setTimeout(r, 20));
  ok(!D.SYNC.err && !D.SYNC.holdUntil && GH.patches === n + 1, `after the wait it uploads by itself (${D.SYNC.err})`);
  ok(await remoteCards() === "Lightning×2, Sol×1", "and the other device gets the cards");

  // ---- 2. primary rate limit (remaining 0, reset time)
  const reset = Math.floor(Date.now() / 1e3) + 600;
  GH.limit = { msg: "API rate limit exceeded for user ID 1.", h: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } };
  D.addToColl(D.slim(cs), "nonfoil", 1, "main"); await settle(); await D.sync();
  ok(D.SYNC.holdUntil >= reset * 1e3 && /try again by/.test(D.SYNC.err), "API limit: waits until GitHub's reset time");
  const p0 = GH.patches; D.addToColl(D.slim(cs), "nonfoil", 1, "main"); await settle(); await D.sync();
  ok(GH.patches === p0 && D.SYNC.dirty, "while GitHub says wait, even a tap on Sync doesn't send (that only makes the wait longer); the change stays saved here");
  ok(D.pushGap() === 180e3, "for an hour after GitHub asked to slow down, saves are 3 minutes apart");
  D.SYNC.holdUntil = 0; D.SYNC.rateAt = 0; await D.sync(); ok(!D.SYNC.err, "once the wait is over, a tap on Sync goes straight away");

  // ---- 3. a token that can't write gists
  GH.limit = { msg: "Resource not accessible by personal access token", h: {} };
  D.addToColl(D.slim(kiora), "nonfoil", 1, "main"); await settle(); await D.sync();
  ok(/isn't allowed to save gists/.test(D.SYNC.err) && /"gist" permission/.test(D.SYNC.err), `says what to fix (${D.SYNC.err})`);
  GH.limit = { msg: "Something else", h: {} }; await D.sync();
  ok(/refused the request \(403\): Something else/.test(D.SYNC.err), `other 403s show GitHub's own words (${D.SYNC.err})`);
  await D.sync(); ok(!D.SYNC.err, "next sync works");

  // ---- 4. automatic uploads are spaced out (scanning adds a card every second or two)
  n = GH.patches;
  for (let i = 0; i < 6; i++) { D.addToColl(D.slim(P("x" + i, "Card " + i)), "nonfoil", 1, "main"); await settle(); await D.syncNow(); for (let k = 0; k < 100 && D.SYNC.busy; k++) await new Promise(r => setTimeout(r, 20)); }
  ok(GH.patches - n <= 1, `6 cards added in a row: ${GH.patches - n} upload(s), not 6`);
  ok(D.pushGap() === 60e3, "while changes keep coming, saves to GitHub are a minute apart");
  D.SYNC.lastPush = Date.now() - 60e3 - 1; await D.syncNow(); for (let k = 0; k < 100 && D.SYNC.busy; k++) await new Promise(r => setTimeout(r, 20));
  ok(!D.SYNC.dirty && /Card 5/.test(JSON.stringify(D.S().coll)), "the rest go up together once the gap has passed");
  const rc = await remoteCards(); ok((rc.match(/Card×1/g) || []).length === 6, `other device gets all 6 (${rc})`);
  D.close(); process.exit();
})();
