const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name, set, num) => ({ id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const sol = P("sol", "Sol Ring", "cmm", "1"), bolt = P("bolt", "Lightning Bolt", "2x2", "2"), cs = P("cs", "Counterspell", "mh2", "3"), path = P("path", "Path to Exile", "con", "4");
// Restoring a backup: with Sync on (GitHub here; Google Drive in restoredrive.test.js) it combines — nothing on the
// device or in the synced copy is removed, including changes not synced yet; with Sync off it replaces, as before. And
// backup files are checked before anything changes.
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
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,syncSheet,go,closeSheet,undoSync,pickSync,restoreBackup,prepareBackup,readRemote,save,flushSave,ONE,restoreWords,ioSheet,stop:()=>{clearInterval(SYNC.poll);SYNC.poll=null;clearTimeout(SYNC.t);},clearBase:async()=>{SYNC.base=null;await idbSet('syncBase',null);},base:()=>SYNC.base};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}

const bk = T => JSON.parse(JSON.stringify(T.S()));
const remote = async T => { T.SYNC.etag = null; const r = await T.readRemote(); return Object.values(r.state.coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ") + " | " + Object.values(r.state.decks).map(d => d.name).sort().join(","); };
const decks = T => Object.values(T.S().decks).map(d => d.name).sort().join(",");
const wait = ms => new Promise(r => setTimeout(r, ms));
const deck = (id, name, t) => ({ id, name, format: "commander", cmdr: [], cards: {}, created: t, updated: t });
const del = (T, re) => { delete T.S().coll[Object.keys(T.S().coll).find(k => re.test(T.S().coll[k].name))]; T.save(); };
(async () => {
  const live = [];
  const setup = async () => { for (const d of live) d.stop(); GH.gists = {}; const A = await device("tablet"), B = await device("phone"); live.push(A, B);
    A.addToColl(A.slim(sol), "nonfoil", 3, "main"); A.addToColl(A.slim(bolt), "nonfoil", 2, "main"); A.S().decks.d1 = deck("d1", "Izzet", 1);
    await A.connectSync("ghp_good"); await A.sync(); await B.connectSync("ghp_good"); await B.sync();
    for (const d of [A, B]) { d.ONE.every = 1e12; d.ONE.at = Date.now(); } return [A, B]; };
  const after = async A => { for (let i = 0; i < 100 && A.SYNC.busy; i++) await wait(20); await A.sync(); return [A.cards() + " | " + decks(A), await remote(A)]; };
  const R = {};
  // 1. an older backup; the synced copy has newer cards and a deck from the phone
  { const [A, B] = await setup(); const old = bk(A);
    B.addToColl(B.slim(path), "nonfoil", 1, "main"); B.S().decks.d2 = deck("d2", "Phone deck", 2); B.save(); await wait(300); await B.sync(); await A.sync();
    R.s1 = [await A.restoreBackup(old), ...(await after(A))]; }
  // 2. a backup with fewer cards than the device
  { const [A] = await setup(); const old = bk(A); A.addToColl(A.slim(cs), "nonfoil", 1, "main"); A.addToColl(A.slim(sol), "nonfoil", 2, "main"); A.save(); await wait(300); await A.sync();
    await A.restoreBackup(old); R.s2 = await after(A); }
  // 3. a deletion made here, not synced yet (the backup has the card): it comes back
  { const [A] = await setup(); const old = bk(A); del(A, /Bolt/); await wait(300);
    await A.restoreBackup(old); R.s3 = await after(A); }
  // 3b. cards and a deck added here, not synced yet
  { const [A] = await setup(); const old = bk(A); A.addToColl(A.slim(path), "nonfoil", 4, "main"); A.S().decks.d3 = deck("d3", "New here", 3); A.save(); await wait(300);
    await A.restoreBackup(old); R.s3b = await after(A); }
  // 3c. a deletion made here and synced, card not in the backup either: stays deleted
  { const [A] = await setup(); A.addToColl(A.slim(cs), "nonfoil", 1, "main"); A.save(); await wait(300); await A.sync(); const withCs = bk(A); del(A, /Counterspell/); await wait(300); await A.sync();
    const old = JSON.parse(JSON.stringify(withCs)); delete old.coll[Object.keys(old.coll).find(k => /Counterspell/.test(old.coll[k].name))];
    await A.restoreBackup(old); R.s3c = await after(A); }
  // 4. another device's backup
  { const [A, B] = await setup(); B.addToColl(B.slim(path), "nonfoil", 2, "main"); const bb = bk(B); A.addToColl(A.slim(cs), "nonfoil", 1, "main"); A.save(); await wait(300); await A.sync();
    const meta = JSON.stringify(A.S().meta.binder ?? null);
    await A.restoreBackup(bb); R.s4 = [...(await after(A)), JSON.stringify(A.S().meta.binder ?? null) === meta]; }
  // 7. the backup's record of the last sync matches this device's (made right after it); changes here since
  { const [A] = await setup(); await A.sync(); const fresh = bk(A); A.addToColl(A.slim(path), "nonfoil", 2, "main"); A.save(); await wait(300);
    R.s7trusted = fresh.meta.syncId === A.S().meta.syncId; await A.restoreBackup(fresh); R.s7 = await after(A); }
  // 7b. the same, and the phone removed Sol Ring meanwhile: the backup's Sol Ring comes back, everywhere
  { const [A, B] = await setup(); await A.sync(); const fresh = bk(A); del(B, /Sol/); await wait(300); await B.sync();
    await A.restoreBackup(fresh); R.s7b = await after(A); await B.sync(); R.s7bPhone = B.cards(); }
  // 7c. after a restore, syncing goes back to normal: a deletion on the phone reaches the tablet
  { const [A, B] = await setup(); const old = bk(A); await A.restoreBackup(old); await after(A); await B.sync();
    del(B, /Bolt/); await wait(300); await B.sync(); await A.sync(); R.s7c = [A.cards(), await remote(A)]; }
  // 8. no sync record here; and a stale one
  { const [A] = await setup(); const old = bk(A); A.addToColl(A.slim(cs), "nonfoil", 1, "main"); A.save(); await wait(300); await A.sync(); await A.clearBase();
    await A.restoreBackup(old); R.s8 = await after(A); }
  { const [A, B] = await setup(); const old = bk(A); B.addToColl(B.slim(path), "nonfoil", 1, "main"); B.save(); await wait(300); await B.sync();
    A.addToColl(A.slim(cs), "nonfoil", 1, "main"); A.save(); await wait(300);
    await A.restoreBackup(old); R.s8stale = await after(A); }
  // local-only things: the scan list and this device's settings stay
  { const [A] = await setup(); const old = bk(A); old.scanSession = [{ id: "x", state: "added" }]; A.S().scanSession = [{ id: "mine", state: "review" }]; A.S().meta.mine = 1;
    await A.restoreBackup(old); R.local = [JSON.stringify(A.S().scanSession.map(x => x.id)), A.S().meta.mine]; }
  // Sync off: replaces, as before
  { const C = await device("pc"); live.push(C); C.addToColl(C.slim(sol), "nonfoil", 1, "main"); const old = bk(C); C.addToColl(C.slim(path), "nonfoil", 5, "main");
    old.scanSession = [{ id: "x", state: "added" }]; const r = await C.restoreBackup(old); R.off = [r.combined, C.cards(), C.S().scanSession.length]; }
  // ---- checking backup files
  const V = await device("checker"); live.push(V); V.addToColl(V.slim(sol), "nonfoil", 3, "main"); V.S().decks.k = deck("k", "Keep", 1); V.save();
  const tryRestore = async d => { const before = JSON.stringify(V.pickSync(V.S())); let msg = "accepted"; try { const r = await V.restoreBackup(JSON.parse(JSON.stringify(d))); msg = "accepted, skipped " + r.skipped; } catch (e) { msg = "refused: " + e.message; } const same = JSON.stringify(V.pickSync(V.S())) === before; return [msg, same]; };
  const good = bk(V);
  for (const [k, d] of [["noColl", { decks: {} }], ["noDecks", { coll: {} }], ["collNull", { coll: null, decks: {} }], ["decksNull", { coll: {}, decks: null }], ["collList", { coll: [], decks: {} }], ["decksList", { coll: {}, decks: [] }], ["rootList", []], ["rootNull", null], ["rootString", "backup"],
      ["allBad", { coll: { a: null, b: "<img>", c: { id: "x", name: "X", qty: "lots", finish: "nonfoil" } }, decks: { z: 5 } }]])
    R["v_" + k] = await tryRestore(d);
  // some damaged entries: left out and counted, the rest restored (decks of the wrong shape too); nothing half-done
  const mixed = JSON.parse(JSON.stringify(good)); mixed.coll.bad1 = null; mixed.coll.bad2 = { id: "y", name: "Y", qty: -2, finish: "nonfoil" }; mixed.coll.bad3 = { id: "z", name: "Z", qty: 1.5 }; mixed.coll.bad4 = { name: "No id", qty: 1 };
  mixed.decks.bad = "nope"; mixed.decks.k.cards.c1 = { name: "Card", qty: 0 }; mixed.decks.k.cards.c2 = { id: "c2", name: "Good card", qty: 2 }; mixed.binders = []; mixed.hist = "x";
  V.addToColl(V.slim(bolt), "nonfoil", 9, "main");
  const rm = await V.restoreBackup(mixed); R.mixed = [rm.skipped, V.cards(), Object.values(V.S().decks).map(d => d.name + ":" + Object.values(d.cards).map(c => c.name + "×" + c.qty).join("+")).join(), Array.isArray(V.S().hist), !!V.S().binders.main];
  // a backup that breaks while being brought up to date leaves this device exactly as it was
  const before = JSON.stringify(V.pickSync(V.S())); const evil = JSON.parse(JSON.stringify(good)); Object.defineProperty(evil, "alerts", { value: { a: { get target() { throw new Error("boom"); } } }, enumerable: true });
  let em = ""; try { await V.restoreBackup(evil); } catch (e) { em = e.message; } R.evil = [em, JSON.stringify(V.pickSync(V.S())) === before];
  // an older-format backup (before binders, conditions, sealed products, lists; quantities written as text)
  const older = { coll: { "sol|nonfoil": { id: "sol", name: "Sol Ring", set: "cmm", num: "1", qty: "2", finish: "nonfoil", prices: { usd: "1" }, finishes: ["nonfoil"] }, "bolt|foil": { id: "bolt", name: "Lightning Bolt", set: "2x2", num: "2", qty: 1, finish: "foil", prices: {}, finishes: ["nonfoil", "foil"] } }, decks: { o: { id: "o", name: "Old deck", cards: { x: { name: "Sol Ring", qty: 1 } } } }, alerts: {} };
  const ro = await V.restoreBackup(older); R.older = [ro.skipped, V.cards(), Object.values(V.S().coll).every(e => e.binder && V.S().binders[e.binder]), V.S().decks.o && V.S().decks.o.format, !!V.S().sealed && !!V.S().lists];
  // the current format
  const rg = await V.restoreBackup(good); R.current = [rg.skipped, V.cards(), decks(V)];
  for (const d of live) d.stop();
  console.log(JSON.stringify(R, null, 1));
  const J = JSON.stringify;
  ok(R.s1[0].combined && R.s1[1] === "Lightning×2, Path×1, Sol×3 | Izzet,Phone deck" && R.s1[2] === "Lightning×2, Path×1, Sol×3 | Izzet,Phone deck", "1. older backup, newer cards in the synced copy: all kept, here and in the synced copy " + J(R.s1));
  ok(R.s2[0] === "Counterspell×1, Lightning×2, Sol×5 | Izzet" && R.s2[1] === "Counterspell×1, Lightning×2, Sol×5 | Izzet", "2. backup with fewer cards: the extra cards and copies stay " + J(R.s2));
  ok(R.s3[0] === "Lightning×2, Sol×3 | Izzet" && R.s3[1] === "Lightning×2, Sol×3 | Izzet", "3. a card deleted here (not synced) that the backup has: it comes back " + J(R.s3));
  ok(R.s3b[0] === "Lightning×2, Path×4, Sol×3 | Izzet,New here" && R.s3b[1] === "Lightning×2, Path×4, Sol×3 | Izzet,New here", "3b. cards and a deck added here, not synced yet: kept, and synced (they were lost before) " + J(R.s3b));
  ok(R.s3c[0] === "Lightning×2, Sol×3 | Izzet" && R.s3c[1] === "Lightning×2, Sol×3 | Izzet", "3c. a deletion that's synced, and not in the backup either: stays deleted " + J(R.s3c));
  ok(R.s4[0] === "Counterspell×1, Lightning×2, Path×2, Sol×3 | Izzet" && R.s4[1] === "Counterspell×1, Lightning×2, Path×2, Sol×3 | Izzet" && R.s4[2], "4. another device's backup: combined, this device's own settings kept " + J(R.s4));
  ok(R.s7trusted && R.s7[0] === "Lightning×2, Path×2, Sol×3 | Izzet" && R.s7[1] === "Lightning×2, Path×2, Sol×3 | Izzet", "7. backup made right after the last sync, changes here since: kept (lost before) " + J(R.s7));
  ok(R.s7b[0] === "Lightning×2, Sol×3 | Izzet" && R.s7b[1] === "Lightning×2, Sol×3 | Izzet" && R.s7bPhone === "Lightning×2, Sol×3", "7b. the phone removed Sol Ring since; the backup's Sol Ring comes back everywhere (it didn't before) " + J([R.s7b, R.s7bPhone]));
  ok(R.s7c[0] === "Sol×3" && R.s7c[1] === "Sol×3 | Izzet", "7c. after the restore, syncing is normal again: a later deletion on the phone reaches the tablet " + J(R.s7c));
  ok(R.s8[0] === "Counterspell×1, Lightning×2, Sol×3 | Izzet" && R.s8[1] === "Counterspell×1, Lightning×2, Sol×3 | Izzet", "8. no sync record here: combined, nothing lost " + J(R.s8));
  ok(R.s8stale[0] === "Counterspell×1, Lightning×2, Path×1, Sol×3 | Izzet" && R.s8stale[1] === "Counterspell×1, Lightning×2, Path×1, Sol×3 | Izzet", "8. an out-of-date record, plus a change here and one elsewhere: all kept " + J(R.s8stale));
  ok(R.local[0] === '["mine"]' && R.local[1] === 1, "this device's scan list and settings stay (the backup's aren't taken)");
  ok(R.off[0] === false && R.off[1] === "Sol×1" && R.off[2] === 1, "Sync off: restoring replaces everything, as before " + J(R.off));
  for (const k of ["noColl", "noDecks", "collNull", "decksNull", "collList", "decksList", "rootList", "rootNull", "rootString"])
    ok(/^refused: That isn't a Deckhand backup/.test(R["v_" + k][0]) && R["v_" + k][1], `backup check: ${k} refused, nothing here changed`);
  ok(/^refused: That backup is damaged: none of its cards or decks could be read/.test(R.v_allBad[0]) && R.v_allBad[1], "every entry damaged: refused, nothing changed");
  ok(R.mixed[0] === 6 && R.mixed[1] === "Sol×3" && R.mixed[2] === "Keep:Good card×2" && R.mixed[3] && R.mixed[4], "some damaged entries: 6 left out and counted, the rest restored; bad sections replaced with empty ones " + J(R.mixed));
  ok(/damaged and couldn't be read/.test(R.evil[0]) && R.evil[1], "a backup that breaks while being read leaves this device exactly as it was " + J(R.evil));
  ok(R.older[0] === 0 && R.older[1] === "Lightning×1, Sol×2" && R.older[2] && R.older[3] === "casual" && R.older[4], "an older-format backup still restores (binders, deck format, new sections filled in) " + J(R.older));
  ok(R.current[0] === 0 && R.current[1] === "Sol×3" && R.current[2] === "Keep", "a current backup restores " + J(R.current));
  process.exit();
})();
