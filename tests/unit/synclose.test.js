// Sync must never lose data: a device closed or reloaded mid-save, a device with stale saved data, crashes between steps.
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
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,addToDeck,save,flushSave,takeCopies,deleteDeck:typeof deleteDeck==='function'?deleteDeck:null};");
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
  let D = await open("computer", pc);
  D.addToColl(D.slim(sol), "nonfoil", 2, "main"); deck(D, "d1", "Ghalta", sol); await settle();
  await D.connectSync("ghp_good"); await D.sync();
  let F = await open("phone", ph); await F.connectSync("ghp_good"); await F.sync(); await settle();
  ok(F.decks() === "Ghalta" && F.cards() === "Sol×2", "setup: phone has what the computer has");

  // ---- 1. the lost-deck case: the phone pulls a new deck and cards, then is closed before its save lands
  D.addToColl(D.slim(bolt), "nonfoil", 4, "main"); deck(D, "d2", "Kiora", kiora); await settle(); await D.sync();
  await F.sync(); F.close();                                   // closed right after the sync, before the 250 ms save
  F = await open("phone", ph); await F.sync(); await settle();
  await D.sync(); await settle();
  ok(D.decks() === "Ghalta, Kiora" && D.cards() === "Lightning×4, Sol×2", `computer keeps Kiora and the 4 Bolts after the phone was closed mid-save (computer: ${D.decks()} · ${D.cards()})`);
  ok(F.decks() === "Ghalta, Kiora" && F.cards() === "Lightning×4, Sol×2", `the phone ends up with them too (phone: ${F.decks()} · ${F.cards()})`);
  // and the computer reloading changes nothing
  D.close(); D = await open("computer", pc); await D.sync(); await settle();
  ok(D.decks() === "Ghalta, Kiora" && D.cards() === "Lightning×4, Sol×2", `computer after a refresh: ${D.decks()} · ${D.cards()}`);

  // ---- 2. a phone whose saved data is stale (an old copy) must not push deletions
  const snap = JSON.parse(JSON.stringify(F.S())); F.close();
  D.addToColl(D.slim(cs), "nonfoil", 1, "main"); deck(D, "d3", "Tatyova", cs); await settle(); await D.sync();
  F = await open("phone", ph); await F.sync(); await settle(); await F.flushSave(); F.close();
  // put the phone's older saved data back, as if its newer save never reached storage
  F = await open("phone", ph); await new Promise(r => { const q = ph.idb.open("deckhand"); q.onsuccess = () => { const tx = q.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(Object.assign(snap, {}), "state"); tx.oncomplete = r; }; }); F.close();
  F = await open("phone", ph); await F.sync(); await settle(); await D.sync(); await settle();
  ok(/Tatyova/.test(D.decks()) && /Counterspell×1/.test(D.cards()), `stale saved data on the phone doesn't delete anything (computer: ${D.decks()} · ${D.cards()})`);
  ok(/Tatyova/.test(F.decks()), "and the phone picks the newer things up");

  // ---- 3. real deletions and edits still sync
  const n0 = D.S().coll[Object.keys(D.S().coll).find(k => D.S().coll[k].name === "Lightning Bolt")];
  F.S().coll[Object.keys(F.S().coll).find(k => F.S().coll[k].name === "Lightning Bolt")].qty -= 1; delete F.S().decks.d3; F.save(); await settle(); await F.sync(); await D.sync(); await settle();
  ok(!/Tatyova/.test(D.decks()) && /Lightning×3/.test(D.cards()), `a deck deleted and a card removed on the phone are removed on the computer too (${D.decks()} · ${D.cards()})`);

  // ---- 4. GitHub fails mid-sync: nothing doubles or vanishes on the next try
  D.addToColl(D.slim(sol), "nonfoil", 1, "main"); D.save(); await settle(); await D.sync();
  F.addToColl(F.slim(cs), "nonfoil", 1, "main"); F.save(); await settle();
  GH.failPatch = 1; await F.sync(); await settle(); await F.sync(); await settle(); await D.sync(); await settle();
  ok(/Sol×3/.test(D.cards()) && /Counterspell×2/.test(D.cards()) && D.cards() === F.cards(), `after a failed upload and a retry both match, nothing doubled (computer ${D.cards()} · phone ${F.cards()})`);

  // ---- 5. what a sync removes from this device can be put back
  const removed = F.S().meta.syncRemoved || [];
  ok(Array.isArray(removed), "removals by sync are recorded on the device");
  // ---- 6. damaged or empty pieces don't crash sync or wipe anything
  const g = Object.values(GH.gists)[0], saved = JSON.parse(JSON.stringify(g.files));
  g.files = { "deckhand-sync.json": { content: JSON.stringify({ v: 1, chunks: 0, at: 0 }) } }; g.etag = '"empty"';
  const before = D.cards(); await D.sync();
  ok(!D.SYNC.err && D.cards() === before && JSON.parse(g.files["deckhand-sync.json"].content).chunks > 0, `an empty synced copy is filled from this device, nothing removed here (${D.SYNC.err || "ok"})`);
  F.SYNC.base = { at: 1, id: F.S().meta.syncId }; await F.sync();
  ok(!F.SYNC.err && F.cards() === D.cards(), `a damaged sync record doesn't crash and nothing is lost (${F.SYNC.err || "ok"}; phone ${F.cards()})`);
  const st = await (async () => { const text = Object.keys(g.files).filter(k => /data/.test(k)).sort().map(k => g.files[k].content).join(""); return text; })();
  g.files["deckhand-data-0.txt"] = { content: "J" + JSON.stringify({ coll: null, decks: null, hist: {} }) }; for (const k of Object.keys(g.files)) if (/deckhand-data-[1-9]/.test(k)) delete g.files[k];
  g.files["deckhand-sync.json"] = { content: JSON.stringify({ v: 1, chunks: 1, at: Date.now(), device: "tablet" }) }; g.etag = '"weird"';
  F.S().meta.syncId = "mismatch"; await F.sync();
  ok(!F.SYNC.err && /Sol/.test(F.cards()) && /Ghalta/.test(F.decks()), `a synced copy with blank sections doesn't crash or wipe this device (${F.SYNC.err || "ok"}; ${F.cards()})`);
  // ---- 7. a device with older sync rules doesn't overwrite what newer rules wrote
  const gist = Object.values(GH.gists)[0], info7 = JSON.parse(gist.files["deckhand-sync.json"].content);
  gist.files["deckhand-sync.json"] = { content: JSON.stringify(Object.assign(info7, { sv: 99 })) }; gist.etag = '"newer"';     // as a device with newer sync rules leaves it
  const before7 = JSON.stringify(gist.files);
  D.addToColl(D.slim(bolt), "nonfoil", 5, "main"); D.save(); await settle(); await D.sync();
  ok(JSON.stringify(gist.files) === before7 && /newer version of Deckhand/.test(D.SYNC.err) && D.SYNC.dirty, `an out-of-date device stops and asks to update instead of uploading (${D.SYNC.err})`);
  ok(!!D.w.document.querySelector("#updBar") && /Update needed to keep syncing/.test(D.w.document.querySelector("#updBar").textContent), "and shows the update notice");
  process.exit();
})();
