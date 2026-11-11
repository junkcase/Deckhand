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
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,syncSheet,go,closeSheet,undoSync,pickSync};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}
(async () => {
  const A = await device("tablet");
  A.addToColl(A.slim(sol), "nonfoil", 3, "main"); A.addToColl(A.slim(bolt), "nonfoil", 2, "main");
  A.S().decks.d1 = { id: "d1", name: "Izzet Spells", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
  let bad = null; try { await A.connectSync("ghp_wrong"); } catch (e) { bad = e; }
  ok(bad && bad.auth && !A.SYNC.cfg, "a wrong token is refused with a clear message");
  await A.connectSync("ghp_good"); await A.sync();
  const g = Object.values(GH.gists)[0];
  ok(g && g.description.includes("Deckhand") && g.files["deckhand-data-0.txt"] && g.files["deckhand-data-0.txt"].content[0] === "G", "connecting creates one private gist and saves the collection there, compressed");

  const B = await device("phone");
  await B.connectSync("ghp_good"); await B.sync();
  ok(B.cards() === "Lightning×2, Sol×3" && B.S().decks.d1 && B.S().decks.d1.name === "Izzet Spells", "second device (empty) gets the cards and decks: " + B.cards());
  ok(Object.keys(GH.gists).length === 1, "…using the same gist, not a new one");

  // both change something before syncing
  A.addToColl(A.slim(cs), "nonfoil", 1, "main");
  const bk = Object.keys(B.S().coll).find(k => k.startsWith("bolt")); B.S().coll[bk].qty = 1; B.S().decks.d1.name = "Izzet Spellslinger"; B.S().decks.d1.updated = 5;
  await A.sync(); await B.sync(); await A.sync();
  ok(A.cards() === "Counterspell×1, Lightning×1, Sol×3" && B.cards() === A.cards(), `changes from both devices are combined: tablet ${A.cards()} | phone ${B.cards()}`);
  ok(A.S().decks.d1.name === "Izzet Spellslinger", "deck renamed on the phone shows on the tablet");
  // same card added on both: both additions count
  A.addToColl(A.slim(path), "nonfoil", 1, "main"); B.addToColl(B.slim(path), "nonfoil", 2, "main");
  await A.sync(); await B.sync(); await A.sync();
  ok(/Path×3/.test(A.cards()) && /Path×3/.test(B.cards()), "the same card added on both devices: 1 + 2 = " + (A.cards().match(/Path×\d/) || [])[0]);
  // nothing changed: cheap check, no upload
  GH.calls = []; await A.sync(); await A.sync();
  ok(!GH.calls.some(c => c.startsWith("PATCH")), "nothing changed: no upload (" + GH.calls.join(", ") + ")");
  // undo
  B.addToColl(B.slim(sol), "nonfoil", 5, "main"); await B.sync(); await A.sync();
  ok(/Sol×8/.test(A.cards()), "tablet got the phone's 5 extra Sol Rings");
  A.undoSync(); await A.sync(); await B.sync();
  ok(/Sol×3/.test(A.cards()) && /Sol×3/.test(B.cards()), "Undo the last sync on the tablet puts it back, everywhere: " + A.cards());

  // a third device that already had a different collection: combines, removing nothing
  const C = await device("computer");
  C.addToColl(C.slim(sol), "nonfoil", 1, "main"); C.addToColl(C.slim(bolt), "nonfoil", 4, "main");
  await C.connectSync("ghp_good"); await C.sync();
  ok(!C.SYNC.ask && !C.SYNC.err, "device that already has cards: combines on its own (no question that could replace one side's cards)");
  ok(/Sol×3/.test(C.cards()) && /Lightning×4/.test(C.cards()) && /Counterspell×1/.test(C.cards()), "Combine: every card from both, shared cards at the larger count: " + C.cards());
  await A.sync(); ok(/Lightning×4/.test(A.cards()), "…and the tablet picks that up: " + A.cards());

  // a big collection: split into parts under GitHub's size limit, read back intact
  const rnd = n => Array.from({ length: n }, () => Math.random().toString(36).slice(2)).join("");
  for (let i = 0; i < 4000; i++) { const c = P("x" + i, "Card " + i + " " + rnd(40), "zzz", String(i)); A.addToColl(A.slim(c), "nonfoil", 1 + (i % 3), "main"); }
  await A.sync();
  const parts = Object.keys(Object.values(GH.gists)[0].files).filter(f => f.startsWith("deckhand-data")).length;
  await B.sync();
  ok(parts > 1 && Object.keys(B.S().coll).length === Object.keys(A.S().coll).length, `big collection (${Object.keys(A.S().coll).length} entries) saved in ${parts} parts and read back whole`);
  // settings stay per device
  A.S().meta.scanMode = "any"; A.S().meta.fullPhoto = true; A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.sync(); await B.sync();
  ok(B.S().meta.scanMode !== "any" && !B.S().meta.fullPhoto, "scan settings stay separate on each device");
  // expired token
  GH.token = "ghp_new"; await A.sync();
  ok(/didn't accept the token/.test(A.SYNC.err), "token deleted or expired: says so and asks for a new one");
  process.exit();
})();
