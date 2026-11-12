// Interrupted saves and data integrity: failed/aborted storage writes, the newer of two stored copies at start-up,
// downloads of the synced copy that fail partway (GitHub and Google Drive), an upload whose reply is lost, a restore
// the device can't save. Everything is pretend: a fake GitHub, a fake Drive, a test database.
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
  if (m === "PATCH") { const b = JSON.parse(o.body); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"'; if (GH.loseReply) throw new TypeError("Failed to fetch (reply lost)"); return J(g); }
  if ((o.headers || {})["If-None-Match"] === g.etag) return new Response(null, { status: 304, headers: { ETag: g.etag } });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, GH.truncate && /data/.test(k) ? { content: v.content.slice(0, 50), truncated: true, raw_url: "https://gist.githubusercontent.com/raw/" + g.id + "/" + k } : { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
async function device(name, opt = {}) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  w.scrollTo = () => {}; w.indexedDB = opt.idb || new IDBFactory(); if (opt.ls) for (const [k, v] of Object.entries(opt.ls)) w.localStorage.setItem(k, v);
  Object.assign(w, { CompressionStream, DecompressionStream, Response, TextEncoder, TextDecoder }); if (opt.nodeBlob) w.Blob = Blob;
  w.fetch = async (u, o) => { if (opt.fetch) { const r = await opt.fetch(String(u), o, w); if (r) return r; } return String(u).startsWith("https://api.github.com") ? github(String(u), o) : String(u).startsWith("https://gist.githubusercontent.com") ? raw(String(u)) : { ok: false, status: 404, json: async () => ({}) }; };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.X={GD,setSyncCfg,syncCfg,gdSignedIn};window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,save,flushSave,restoreBackup,readRemote,idb,ONE,GDS,syncBase,idbOpen,idbGet,idbSet,setSyncBase,gdReadSync,stop:()=>{clearInterval(SYNC.poll);SYNC.poll=null;clearTimeout(SYNC.t);},toasts:()=>document.querySelector('#toastRoot')?.textContent||''};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.X = w.X; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}

async function raw(u) { const [, , , , id, k] = u.split("/"); const g = GH.gists[id]; const c = g.files[k].content; if (GH.rawFail === "cut") return new Response(c.slice(0, Math.floor(c.length / 2))); if (GH.rawFail === "error") throw new TypeError("network error"); return new Response(c); }

const zlib = require("zlib");
process.on("unhandledRejection", () => {});
const wait = ms => new Promise(r => setTimeout(r, ms));
const qty = (st, name) => Object.values(st.coll).filter(e => e.name === name).reduce((a, e) => a + e.qty, 0);
// make database writes fail: "quota" throws at the write, "abort" lets the write start and then aborts the transaction
async function breakIdb(T, how) { const db = await T.idbOpen(); if (!db.__orig) db.__orig = db.transaction.bind(db); T.w.__idbFail = how;
  db.transaction = (s, m) => { const tx = db.__orig(s, m); if (m === "readwrite" && T.w.__idbFail) { const st = tx.objectStore("kv"), put = st.put.bind(st);
    if (T.w.__idbFail === "abort") st.put = (...a) => { const r = put(...a); T.w.queueMicrotask(() => { try { tx.abort(); } catch (e) {} }); return r; };
    else st.put = () => { throw new T.w.DOMException("The quota has been exceeded.", "QuotaExceededError"); }; } return tx; }; }
const fullLs = T => { const SP = T.w.Storage.prototype, set0 = SP.setItem; SP.setItem = function (k, v) { if (k === "deckhand.v1") throw new T.w.DOMException("full", "QuotaExceededError"); return set0.call(this, k, v); }; return () => { SP.setItem = set0; }; };
const lsOf = T => { const o = {}; for (let i = 0; i < T.w.localStorage.length; i++) { const k = T.w.localStorage.key(i); o[k] = T.w.localStorage.getItem(k); } return o; };

(async () => {
  // ---------- 1. the database write fails, localStorage takes the newer copy, the app is reopened
  for (const how of ["quota", "abort"]) {
    const F = new IDBFactory(); let A = await device("phone", { idb: F });
    A.addToColl(A.slim(sol), "nonfoil", 1, "main"); ok(await A.flushSave() === true, `storage (${how}): a normal save succeeds`);
    await breakIdb(A, how);
    A.addToColl(A.slim(path), "nonfoil", 5, "main"); const r = await A.flushSave();
    ok(r === true && A.idb.ok === false && !!A.w.localStorage.getItem("deckhand.v1"), `storage (${how}): the failed database write is noticed and the newer cards go to localStorage`);
    const ls = lsOf(A); A.stop();
    let B = await device("phone", { idb: F, ls });                                   // reopened: the database works again but holds the older cards
    ok(B.cards() === "Path×5, Sol×1", `storage (${how}): after reopening, the newer localStorage copy is used, not the older database one (got ${B.cards()})`);
    B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave();
    ok(B.cards() === "Lightning×1, Path×5, Sol×1" && !B.w.localStorage.getItem("deckhand.v1"), `storage (${how}): the next save keeps them, in the database again`);
    const C = await device("phone", { idb: F, ls: lsOf(B) }); ok(C.cards() === "Lightning×1, Path×5, Sol×1", `storage (${how}): and they are still there on the next start`); B.stop(); C.stop();
  }
  // a stale localStorage copy (older stamp than the database's) must not win
  { const F = new IDBFactory(); const A = await device("phone", { idb: F });
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave(); const old = JSON.stringify(A.S());
    A.addToColl(A.slim(path), "nonfoil", 3, "main"); await A.flushSave(); A.stop();
    const B = await device("phone", { idb: F, ls: { "deckhand.v1": old } });
    ok(B.cards() === "Path×3, Sol×2", "storage: an older copy left in localStorage doesn't replace the newer database copy"); B.stop(); }
  // both stores fail; then the database recovers
  { const A = await device("phone"); A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave();
    await breakIdb(A, "quota"); const undo = fullLs(A);
    A.addToColl(A.slim(path), "nonfoil", 1, "main");
    ok(await A.flushSave() === false && /Couldn't save/.test(A.toasts()), "storage: when neither store can save, the save reports failure and says so");
    A.w.__idbFail = null; undo();
    ok(await A.flushSave() === true && A.idb.ok === false, "storage: straight after a database failure, saves go to localStorage");
    const RealNow = A.w.Date.now; A.w.Date.now = () => RealNow() + 20000;
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main");
    ok(await A.flushSave() === true && A.idb.ok === true && !A.w.localStorage.getItem("deckhand.v1") && qty(await A.idbGet("state"), "Lightning Bolt") === 1, "storage: a little later the database is tried again, and used once it works");
    A.w.Date.now = RealNow; A.stop(); }
  // leaving the page with a save pending writes a copy that is finished before the page is gone
  { const F = new IDBFactory(); const A = await device("phone", { idb: F });
    A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.flushSave();
    await breakIdb(A, "abort");                                                       // stands in for "the page was gone before the database write finished"
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); A.save();
    A.w.dispatchEvent(new A.w.Event("pagehide")); const ls = lsOf(A);
    ok(!!ls["deckhand.v1"] && qty(JSON.parse(ls["deckhand.v1"]), "Sol Ring") === 5, "leaving: a change not saved yet is written to localStorage as the page goes");
    await wait(50); A.stop();
    const B = await device("phone", { idb: F, ls }); ok(B.cards() === "Sol×5", "leaving: and it is there when the app is opened again"); B.stop(); }

  // ---------- 2. GitHub: a download of the synced copy that fails partway is fetched again
  for (const how of ["cut", "error", "json"]) {
    for (const k in GH.gists) delete GH.gists[k];
    const A = await device("tablet"), B = await device("phone");
    A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    await B.connectSync("ghp_good"); await B.sync(); B.stop();
    B.addToColl(B.slim(path), "nonfoil", 4, "main"); await B.flushSave(); await B.sync();
    const g = Object.values(GH.gists)[0]; let keep = null;
    if (how === "json") { keep = g.files["deckhand-sync.json"].content; g.files["deckhand-sync.json"].content = "{ not json"; } else { GH.truncate = true; GH.rawFail = how; }
    await A.sync(); ok(!!A.SYNC.err && A.cards() === "Sol×3", `GitHub (${how}): the failed download is reported and changes nothing`);
    if (keep) g.files["deckhand-sync.json"].content = keep; GH.truncate = false; GH.rawFail = null;      // same ETag as before
    await A.sync(); ok(!A.SYNC.err && A.cards() === "Path×4, Sol×3", `GitHub (${how}): the next sync downloads it again and gets the other device's cards (got ${A.cards()})`);
    A.stop(); B.stop();
  }

  // ---------- 3. Google Drive: the version is only remembered once the file has been read in full
  { const D = { version: "8", body: null, mode: "ok" };
    const good = n => JSON.stringify({ coll: { "sol|nonfoil|main": { id: "sol", name: "Sol Ring", set: "cmm", cn: "1", finish: "nonfoil", binder: "main", qty: n } }, decks: {}, _sync: { pid: "p" + n, seq: n } });
    const hook = async u => { if (!u.startsWith("https://www.googleapis.com")) return null;
      if (/alt=media/.test(u)) { if (D.mode === "neterr") throw new TypeError("network error"); return new Response(D.body); }
      return new Response(JSON.stringify({ id: "F1", version: D.version, trashed: false, size: String(D.body.length), appProperties: { device: "phone", at: "1", sv: "1" } }), { headers: { "Content-Type": "application/json" } }); };
    const gz = Buffer.from(zlib.gzipSync(good(8)));
    const cases = { "invalid JSON": ["ok", Buffer.from('{"coll": {"sol|nonf')], "gzip of invalid JSON": ["ok", Buffer.from(zlib.gzipSync('{"coll": {"sol|nonf'))], "gzip of a non-object": ["ok", Buffer.from(zlib.gzipSync("null"))], "truncated gzip": ["ok", gz.subarray(0, gz.length >> 1)], "network error": ["neterr", gz] };
    for (const [label, [mode, body]] of Object.entries(cases)) {
      const A = await device("pc", { fetch: hook, nodeBlob: true }); A.X.GD.tok = "t"; A.X.GD.exp = Date.now() + 3600e3; A.X.setSyncCfg({ kind: "google", folder: "FOLD", file: "F1" });
      A.GDS.version = null; D.mode = mode; D.body = body; let threw = false; try { await A.gdReadSync(); } catch (e) { threw = true; }
      const v1 = A.GDS.version; D.mode = "ok"; D.body = gz; let r2 = null; try { r2 = await A.gdReadSync(); } catch (e) {}
      ok(threw && v1 === null && r2 && r2.state && qty(r2.state, "Sol Ring") === 8 && A.GDS.version === "8", `Drive (${label}): the failed read doesn't count as seen; the same version is downloaded again`);
      A.stop();
    } }

  // ---------- 4. an upload that arrives although its reply is lost
  for (const [label, after, want] of [["then one more added", T => T.addToColl(T.slim(sol), "nonfoil", 1, "main"), 6], ["then one removed", T => { Object.values(T.S().coll)[0].qty -= 1; }, 4], ["nothing else changed", () => {}, 5]]) {
    for (const k in GH.gists) delete GH.gists[k];
    const A = await device("tablet"); A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave();
    GH.loseReply = true; await A.sync(); GH.loseReply = false;
    const B = await device("phone"); await B.connectSync("ghp_good"); await B.sync(); B.stop();
    ok(!!A.SYNC.err && B.cards() === "Sol×5", `lost reply (${label}): the upload did arrive, the device was told it failed`);
    after(A); await A.flushSave(); await A.sync(); await B.sync();
    ok(!A.SYNC.err && A.cards() === `Sol×${want}` && B.cards() === `Sol×${want}`, `lost reply (${label}): the next sync has ${want} copies everywhere, not counted twice (here ${A.cards()}, other device ${B.cards()})`);
    A.stop(); B.stop();
  }
  // …also when the app was reopened in between (what was sent is kept with the sync record)
  { for (const k in GH.gists) delete GH.gists[k];
    const F = new IDBFactory(); const A = await device("tablet", { idb: F }); A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave();
    GH.loseReply = true; await A.sync(); GH.loseReply = false; A.stop();
    const A2 = await device("tablet", { idb: F, ls: lsOf(A) }); A2.stop(); A2.addToColl(A2.slim(sol), "nonfoil", 1, "main"); await A2.flushSave(); await A2.sync();
    ok(!A2.SYNC.err && A2.cards() === "Sol×6", `lost reply, app reopened: still 6 copies, not 8 (got ${A2.cards()})`); A2.stop(); }
  // …and when another device synced on top of that upload first
  { for (const k in GH.gists) delete GH.gists[k];
    const A = await device("tablet"); A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    const B = await device("phone"); await B.connectSync("ghp_good"); await B.sync(); B.stop();
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave();
    GH.loseReply = true; await A.sync(); GH.loseReply = false;
    B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync();
    A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave(); await A.sync(); await B.sync();
    ok(A.cards() === "Lightning×1, Sol×6" && B.cards() === "Lightning×1, Sol×6", `lost reply, another device synced in between: both end with Sol×6 and the other device's card (here ${A.cards()}, there ${B.cards()})`); A.stop(); B.stop(); }

  // ---------- 5. the sync worked but this device couldn't save
  { for (const k in GH.gists) delete GH.gists[k];
    const A = await device("tablet"), B = await device("phone");
    A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    await B.connectSync("ghp_good"); await B.sync(); B.stop(); B.addToColl(B.slim(path), "nonfoil", 2, "main"); await B.flushSave(); await B.sync();
    await breakIdb(A, "quota"); const undo = fullLs(A);
    await A.sync();
    ok(/couldn't save/.test(A.SYNC.err) && A.cards() === "Path×2, Sol×3", "sync, device can't save: the sync doesn't claim all is well");
    A.w.__idbFail = null; undo(); A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); await A.sync(); await B.sync();
    ok(!A.SYNC.err && A.cards() === "Lightning×1, Path×2, Sol×3" && B.cards() === A.cards(), "sync, device can save again: back to normal, both devices the same");
    A.stop(); B.stop(); }

  // ---------- 6. restoring a backup the device can't save
  { for (const k in GH.gists) delete GH.gists[k];
    const A = await device("tablet"); A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    const bk = JSON.parse(JSON.stringify(A.S())); bk.coll = { k: Object.assign({}, A.slim(bolt), { finish: "nonfoil", binder: "main", qty: 4 }) };
    await breakIdb(A, "quota"); const undo = fullLs(A);
    const r = await A.restoreBackup(bk);
    ok(r.combined === true && r.saved === false, "restore, device can't save (Sync on): the result says it wasn't saved");
    await wait(300); while (A.SYNC.busy) await wait(30);
    const B = await device("phone"); await B.connectSync("ghp_good"); await B.sync();
    ok(B.cards() === "Lightning×4, Sol×2" && /couldn't save/.test(A.SYNC.err), "restore, device can't save: the restored cards still reach the synced copy, and the sync says the device couldn't save");
    undo(); A.stop(); B.stop();
    const C = await device("solo"); C.addToColl(C.slim(sol), "nonfoil", 1, "main"); await C.flushSave();
    const r2 = await C.restoreBackup(bk); ok(r2.combined === false && r2.saved === true && C.cards() === "Lightning×4" && qty(await C.idbGet("state"), "Lightning Bolt") === 4, "restore (Sync off): saved before it reports success");
    await breakIdb(C, "quota"); const undo2 = fullLs(C); const r3 = await C.restoreBackup(bk); ok(r3.saved === false, "restore (Sync off), device can't save: the result says so"); undo2(); C.stop(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
