// Sync risks: two tabs of one browser, two devices changing things before either syncs, a device that is offline or
// away for a long time, interrupted Google Drive uploads and change checks, and whether removed cards can come back.
// Everything is pretend (see synckit.js): no real GitHub, Google Drive or browser storage.
const { GH, D, device, driveDevice, driveReset, githubReset, sharedStore, setQty, stamp, lsOf, lastLog, wait, ok, sol, bolt, cs, path, IDBFactory } = require("./synckit.js");
process.on("unhandledRejection", () => {});
const is = (got, want, name) => ok(got === want, `${name}${got === want ? "" : ` (got ${got}; should be ${want})`}`);
const same = (A, B) => A.cards() === B.cards() ? A.cards() : `${A.name} ${A.cards()} ≠ ${B.name} ${B.cards()}`;
const both = async (A, B) => { await A.sync(); await B.sync(); await A.sync(); await B.sync(); };
const seed = T => { T.addToColl(T.slim(sol), "nonfoil", 3, "main"); T.addToColl(T.slim(path), "nonfoil", 2, "main"); };
// two devices on GitHub, or on Google Drive, both holding Sol×3 and Path×2
async function pair(kind = "github") {
  if (kind === "drive") { driveReset(); const A = await driveDevice("computer"), B = await driveDevice("phone"); seed(A); await A.flushSave(); await A.sync(); A.stop(); await B.sync(); B.stop(); return [A, B]; }
  githubReset(); const A = await device("computer"), B = await device("phone"); seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop(); await B.connectSync("ghp_good"); await B.sync(); B.stop(); return [A, B];
}
// two tabs of one browser: one database, one localStorage. Sync on (GitHub) or off.
async function tabs(sync, seedFn = T => T.addToColl(T.slim(sol), "nonfoil", 3, "main")) {
  githubReset(); const F = new IDBFactory(), store = sharedStore();
  const T0 = await device("pc", { idb: F, store }); seedFn(T0); await T0.flushSave(); if (sync) { await T0.connectSync("ghp_good"); await T0.sync(); } T0.stop(); T0.w.__closed = true;
  const open = async () => { const T = await device("pc", { idb: F, store }); T.stop(); if (sync) await T.sync(); return T; };
  const A = await open(), B = await open();
  return { A, B, open, close: T => { T.stop(); T.w.__closed = true; } };
}
const settle = () => wait(260);          // lets the "another tab saved" message arrive and be taken in

(async () => {
  // ================= 1. two tabs =================
  for (const sync of [false, true]) {
    const tag = sync ? "tabs, Sync on" : "tabs, Sync off";
    { const { A, B, open, close } = await tabs(sync);
      A.addToColl(A.slim(path), "nonfoil", 2, "main"); await A.flushSave();
      B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); if (sync) await B.sync();
      await settle();
      is(B.cards(), "Lightning×1, Path×2, Sol×3", `${tag}: tab 1 adds a card, tab 2 adds another: tab 2 has both`);
      is(A.cards(), "Lightning×1, Path×2, Sol×3", `${tag}: …and tab 1 shows both without being reloaded`);
      close(A); close(B); const C = await open(); is(C.cards(), "Lightning×1, Path×2, Sol×3", `${tag}: …and both are there after everything is closed and reopened`);
      if (sync) { const O = await device("other"); await O.connectSync("ghp_good"); await O.sync(); is(O.cards(), "Lightning×1, Path×2, Sol×3", `${tag}: …and on another device`); O.stop(); }
      close(C); }
    { const { A, B, open, close } = await tabs(sync);
      setQty(A, "Sol Ring", 5); await A.flushSave();
      B.S().meta.scanMode = "auto"; B.save(); await B.flushSave(); await settle();
      close(A); close(B); const C = await open();
      ok(C.cards() === "Sol×5" && C.S().meta.scanMode === "auto", `${tag}: tab 1 changes a quantity, tab 2 only a setting: both kept (got ${C.cards()}, setting ${C.S().meta.scanMode})`); close(C); }
    { const { A, B, open, close } = await tabs(sync);
      A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave();
      B.addToColl(B.slim(sol), "nonfoil", 1, "main"); await B.flushSave(); await settle(); if (sync) { await A.sync(); await B.sync(); }
      close(A); close(B); const C = await open(); is(C.cards(), "Sol×5", `${tag}: +1 of the same card in each tab adds up`); close(C); }
    { const { A, B, open, close } = await tabs(sync, seed);
      setQty(A, "Path to Exile", 0); await A.flushSave();
      B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); if (sync) await B.sync(); await settle();
      is(A.cards() + " | " + B.cards(), "Lightning×1, Sol×3 | Lightning×1, Sol×3", `${tag}: tab 1 removes a card, tab 2 adds another: the removed one stays removed in both`);
      close(A); close(B); const C = await open(); is(C.cards(), "Lightning×1, Sol×3", `${tag}: …also after reopening`);
      if (sync) { const O = await device("other"); await O.connectSync("ghp_good"); await O.sync(); is(O.cards(), "Lightning×1, Sol×3", `${tag}: …and on another device`); O.stop(); }
      close(C); }
    { // an idle tab picks up what the other saved, and what it then changes builds on that
      const { A, B, open, close } = await tabs(sync);
      A.addToColl(A.slim(path), "nonfoil", 2, "main"); await A.flushSave(); await settle();
      is(B.cards(), "Path×2, Sol×3", `${tag}: a tab with nothing to save takes in the other tab's change by itself`);
      setQty(B, "Path to Exile", 1); await B.flushSave(); await settle();
      is(A.cards(), "Path×1, Sol×3", `${tag}: …and its own change then goes back the other way`); close(A); close(B); }
    { // tab 1 is closed with a change not saved yet (it leaves a note); tab 2 saves afterwards
      const { A, B, open, close } = await tabs(sync);
      const db = await A.idbOpen(), orig = db.transaction.bind(db); db.transaction = (s, m) => { const tx = orig(s, m); if (m === "readwrite") { const st = tx.objectStore("kv"), put = st.put.bind(st); st.put = (...a) => { const r = put(...a); A.w.queueMicrotask(() => { try { tx.abort(); } catch (e) {} }); return r; }; } return tx; };
      A.addToColl(A.slim(path), "nonfoil", 2, "main"); A.w.dispatchEvent(new A.w.Event("pagehide")); await wait(30); close(A);
      B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await settle();
      close(B); const C = await open(); is(C.cards(), "Lightning×1, Path×2, Sol×3", `${tag}: a tab closed before its save finished, then the other tab saves: nothing lost`); close(C); }
  }
  { // Sync on in both tabs, each syncing after its change
    const { A, B, open, close } = await tabs(true, seed);
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); await A.sync();
    setQty(B, "Path to Exile", 0); B.addToColl(B.slim(sol), "nonfoil", 1, "main"); await B.flushSave(); await B.sync(); await settle(); await A.sync(); await B.sync();
    const O = await device("other"); await O.connectSync("ghp_good"); await O.sync();
    is([A, B, O].map(T => T.cards()).join(" | "), "Lightning×1, Sol×4 | Lightning×1, Sol×4 | Lightning×1, Sol×4", "tabs, Sync on: both tabs sync their own changes: same everywhere, nothing counted twice");
    ok(![A, B].some(T => /combined, nothing removed|keeping everything/.test(lastLog(T, 8))), "tabs, Sync on: …without falling back to \"keep everything\""); close(A); close(B); O.stop(); }

  // ================= 2. two devices change things before either syncs =================
  for (const kind of ["github", "drive"]) {
    const two = async (name, fa, fb, want) => { const [A, B] = await pair(kind); fa(A); fb(B); await A.flushSave(); await B.flushSave(); await both(A, B); is(same(A, B), want, `two devices (${kind}): ${name}`); A.stop(); B.stop(); };
    await two("different new cards on each", A => A.addToColl(A.slim(bolt), "nonfoil", 1, "main"), B => B.addToColl(B.slim(cs), "nonfoil", 2, "main"), "Counterspell×2, Lightning×1, Path×2, Sol×3");
    await two("the same card: +1 on one, +2 on the other", A => A.addToColl(A.slim(sol), "nonfoil", 1, "main"), B => B.addToColl(B.slim(sol), "nonfoil", 2, "main"), "Path×2, Sol×6");
    await two("the same new card added on both (1 and 1)", A => { A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); stamp(A, "Lightning Bolt", 1700000000000); }, B => { B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); stamp(B, "Lightning Bolt", 1700000060000); }, "Lightning×2, Path×2, Sol×3");
    await two("one removes a copy, the other adds one", A => setQty(A, "Sol Ring", 2), B => B.addToColl(B.slim(sol), "nonfoil", 1, "main"), "Path×2, Sol×3");
    await two("one removes a card, the other adds a different one", A => setQty(A, "Path to Exile", 0), B => B.addToColl(B.slim(bolt), "nonfoil", 1, "main"), "Lightning×1, Sol×3");
    await two("both remove the same card", A => setQty(A, "Path to Exile", 0), B => setQty(B, "Path to Exile", 0), "Sol×3");
    await two("one removes a card (2), the other adds 1 of it", A => setQty(A, "Path to Exile", 0), B => B.addToColl(B.slim(path), "nonfoil", 1, "main"), "Path×1, Sol×3");
    await two("both remove 2 of 3 copies", A => setQty(A, "Sol Ring", 1), B => setQty(B, "Sol Ring", 1), "Path×2, Sol×1");
    { const [A, B] = await pair(kind); A.addToColl(A.slim(sol), "nonfoil", 1, "main"); B.addToColl(B.slim(sol), "nonfoil", 2, "main"); await A.flushSave(); await B.flushSave();
      await B.sync(); await B.sync(); await A.sync(); await A.sync(); await B.sync(); await A.sync(); is(same(A, B), "Path×2, Sol×6", `two devices (${kind}): +1 / +2 with the syncs in another order`); A.stop(); B.stop(); }
    { const [A, B] = await pair(kind); A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); B.addToColl(B.slim(sol), "nonfoil", 2, "main"); setQty(B, "Path to Exile", 0); await A.flushSave(); await B.flushSave();
      await Promise.all([A.sync(), B.sync()]); await both(A, B); is(same(A, B), "Lightning×1, Sol×5", `two devices (${kind}): both upload at the same moment`); A.stop(); B.stop(); }
  }

  // ================= 3. offline for a while =================
  for (const kind of ["github", "drive"]) {
    const net = { off: false }; let A, B;
    if (kind === "drive") { [A, B] = await pair("drive"); }
    else { githubReset(); A = await device("computer", { fetch: async () => { if (net.off) throw new TypeError("Failed to fetch"); return null; } }); B = await device("phone"); seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop(); await B.connectSync("ghp_good"); await B.sync(); B.stop(); }
    const off = v => { if (kind === "drive") D.offline = v ? { computer: true } : {}; else net.off = v; };
    off(true);
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); setQty(A, "Path to Exile", 0); await A.flushSave(); await A.sync(); const e = A.SYNC.err; await A.sync();
    B.addToColl(B.slim(sol), "nonfoil", 2, "main"); await B.flushSave(); await B.sync();
    ok(!!e && A.cards() === "Lightning×1, Sol×3", `offline (${kind}): the sync says it couldn't, and the changes stay on the device`);
    off(false); await both(A, B);
    is(same(A, B), "Lightning×1, Sol×5", `offline (${kind}): back online, the offline changes (an add and a removal) and the other device's all arrive`);
    if (kind === "drive") is(String(Object.keys(D.files).length), "1", "offline (drive): still one synced file");
    A.stop(); B.stop();
  }
  { // the connection drops during the upload itself
    const net = { drop: false }; githubReset();
    const A = await device("computer", { fetch: async (u, o) => { if (net.drop && o && o.method === "PATCH") throw new TypeError("Failed to fetch"); return null; } }), B = await device("phone");
    seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop(); await B.connectSync("ghp_good"); await B.sync(); B.stop();
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); net.drop = true; await A.sync(); const e = A.SYNC.err; net.drop = false;
    A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave(); await both(A, B);
    ok(!!e && same(A, B) === "Lightning×1, Path×2, Sol×4", `offline (github): the connection drops during the upload, then works again (${same(A, B)})`); A.stop(); B.stop(); }

  // ================= 4. away while the other device uploads many versions (the version list holds 40) =================
  for (const kind of ["github", "drive"]) {
    for (const n of [38, 39, 40, 41, 45]) {
      const [A, B] = await pair(kind);                                   // the computer is closed, with no changes of its own
      setQty(B, "Sol Ring", 1); setQty(B, "Path to Exile", 0); await B.flushSave(); await B.sync();      // the phone sells 2 of 3 Sol and all Path…
      for (let i = 1; i < n; i++) { B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync(); }      // …and keeps being used
      await A.sync(); await B.sync(); await A.sync();
      is(same(A, B), `Lightning×${n - 1}, Sol×1`, `away for ${n} uploads (${kind}): what the phone removed stays removed`);
      A.stop(); B.stop();
    }
    { // away, with changes of its own, while the other device removed things
      const [A, B] = await pair(kind); A.addToColl(A.slim(cs), "nonfoil", 1, "main"); setQty(A, "Sol Ring", 2); await A.flushSave();
      setQty(B, "Path to Exile", 0); await B.flushSave(); await B.sync();
      for (let i = 0; i < 45; i++) { B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync(); }
      await both(A, B); is(same(A, B), "Counterspell×1, Lightning×45, Sol×2", `away for 46 uploads (${kind}), with its own add and removal: both devices' changes hold`);
      ok(/versions behind; caught up/.test(lastLog(A, 4)), `away for 46 uploads (${kind}): the log says it caught up (not "kept everything")`); A.stop(); B.stop(); }
    { // this device's own upload really was overwritten, and then it was away for a long time: its cards must not be taken for removed
      const [A, B] = await pair(kind);
      A.addToColl(A.slim(cs), "nonfoil", 2, "main"); B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); await B.flushSave();
      // both read the same version, then the computer uploads first and the phone's upload replaces it
      if (kind === "drive") { const f = Object.values(D.files)[0], keep = { body: f.body, version: f.version, appProperties: f.appProperties }; await A.sync(); const mine = { body: f.body, appProperties: f.appProperties };
        Object.assign(f, keep); await B.sync(); /* the phone never saw the computer's upload */ void mine; }
      else { const g = Object.values(GH.gists)[0], keep = JSON.parse(JSON.stringify(g.files)); await A.sync(); g.files = keep; g.etag = '"rewound"'; await B.sync(); }
      for (let i = 0; i < 45; i++) { B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync(); }
      await both(A, B); is(same(A, B), "Counterspell×2, Lightning×46, Path×2, Sol×3", `own upload overwritten, then away for 45 uploads (${kind}): this device's cards are kept, not removed`); A.stop(); B.stop(); }
  }

  // ================= 5. Google Drive: interrupted uploads =================
  for (const fault of ["never", "500", "lost"]) {
    const label = { never: "never arrives", "500": "gets an error from Drive", lost: "arrives but its reply is lost" }[fault];
    { const [A, B] = await pair("drive"); A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave();
      D.fault = { who: "computer", kind: fault }; await A.sync(); const e = A.SYNC.err; await both(A, B);
      ok(!!e && same(A, B) === "Lightning×1, Path×2, Sol×3", `Drive upload ${label}: reported, and right after the next sync (${same(A, B)})`); A.stop(); B.stop(); }
    { const [A, B] = await pair("drive"); A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave();
      D.fault = { who: "computer", kind: fault }; await A.sync(); A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave(); await both(A, B);
      is(same(A, B), "Path×2, Sol×6", `Drive upload ${label}, one more copy added before the retry: counted once`); A.stop(); B.stop(); }
    { const [A, B] = await pair("drive"); setQty(A, "Path to Exile", 0); A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave();
      D.fault = { who: "computer", kind: fault }; await A.sync();
      B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync();
      A.addToColl(A.slim(sol), "nonfoil", 1, "main"); await A.flushSave(); await both(A, B);
      is(same(A, B), "Lightning×1, Sol×6", `Drive upload ${label}, the other device syncs in between: adds and the removal all hold`); A.stop(); B.stop(); }
  }
  { const [A, B] = await pair("drive"); A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave();
    D.fault = { who: "computer", kind: "401" }; await A.sync();
    ok(A.SYNC.needTap === true && A.cards() === "Lightning×1, Path×2, Sol×3", "Drive upload when the Google sign-in has run out: asks to sign in again, cards kept");
    A.X.GD.tok = "t2"; A.X.GD.exp = Date.now() + 3600e3; await both(A, B); is(same(A, B), "Lightning×1, Path×2, Sol×3", "Drive: …and syncs after signing in again"); A.stop(); B.stop(); }
  { // the reply is lost, the app is closed and reopened, one more copy added
    driveReset(); const F = new IDBFactory(); let ls = null;
    const mk = async () => driveDevice("computer", { idb: F, ls: ls || undefined, keepCfg: !!ls });
    const A = await mk(), B = await driveDevice("phone"); A.addToColl(A.slim(sol), "nonfoil", 3, "main"); await A.flushSave(); await A.sync(); await B.sync();
    A.addToColl(A.slim(sol), "nonfoil", 2, "main"); await A.flushSave(); D.fault = { who: "computer", kind: "lost" }; await A.sync(); ls = lsOf(A); A.stop();
    const A2 = await mk(); A2.addToColl(A2.slim(sol), "nonfoil", 1, "main"); await A2.flushSave(); await both(A2, B);
    is(same(A2, B), "Sol×6", "Drive upload arrives, reply lost, app reopened, one more added: 6 copies, not more"); A2.stop(); B.stop(); }

  // ================= 6. Google Drive: the "has it changed?" check fails =================
  for (const kind of ["500", "429", "net"]) {
    const label = kind === "net" ? "a network blip" : "HTTP " + kind;
    const [A, B] = await pair("drive"); setQty(B, "Path to Exile", 0); B.addToColl(B.slim(sol), "nonfoil", 2, "main"); await B.flushSave(); await B.sync();
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); const up = D.uploads; D.metaFail = { who: "computer", kind }; await A.sync();
    ok(!!A.SYNC.err && D.uploads === up && Object.keys(D.files).length === 1 && A.X.syncCfg().file === Object.keys(D.files)[0], `Drive change check fails (${label}): the sync reports it ("${A.SYNC.err}"), uploads nothing, makes no second file, keeps its file`);
    ok(A.cards() === "Lightning×1, Path×2, Sol×3" && !/was empty/.test(lastLog(A, 5)), `Drive change check fails (${label}): nothing is changed on the device and the copy isn't taken for empty`);
    await both(A, B);
    is(same(A, B) + `, ${Object.keys(D.files).length} file`, "Lightning×1, Sol×5, 1 file", `Drive change check fails (${label}): the next sync is right on both devices, the removed card stays removed`);
    A.ONE.at = 0; B.ONE.at = 0; await both(A, B); await both(A, B);
    is(same(A, B) + `, ${Object.keys(D.files).length} file`, "Lightning×1, Sol×5, 1 file", `Drive change check fails (${label}): still right after the "one synced copy" check`);
    A.stop(); B.stop();
  }
  { // the synced file is deleted in Drive by hand
    const [A, B] = await pair("drive"); for (const k of Object.keys(D.files)) delete D.files[k];
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); await both(A, B); await both(A, B);
    is(same(A, B) + `, ${Object.keys(D.files).length} file`, "Lightning×1, Path×2, Sol×3, 1 file", "Drive: the synced file is deleted by hand: the devices end up on one new file with the same cards");
    A.stop(); B.stop(); }
  { // …and both devices notice at the same moment (each makes a file): they settle on one straight away
    const [A, B] = await pair("drive"); for (const k of Object.keys(D.files)) delete D.files[k];
    A.addToColl(A.slim(bolt), "nonfoil", 1, "main"); B.addToColl(B.slim(cs), "nonfoil", 1, "main"); await A.flushSave(); await B.flushSave();
    await Promise.all([A.sync(), B.sync()]); await both(A, B); await both(A, B);
    ok(same(A, B) === "Counterspell×1, Lightning×1, Path×2, Sol×3" && A.X.syncCfg().file === B.X.syncCfg().file, `Drive: file deleted, both devices notice at once: same cards, same file (${same(A, B)})`); A.stop(); B.stop(); }

  // ================= 7. can removed cards come back? =================
  for (const kind of ["github", "drive"]) {
    { const [A, B] = await pair(kind); setQty(A, "Path to Exile", 0); await A.flushSave(); await both(A, B); is(same(A, B), "Sol×3", `removed (${kind}): a plain removal on one device`); A.stop(); B.stop(); }
  }
  { githubReset(); const F = new IDBFactory(); const A = await device("computer", { idb: F }), B = await device("phone"); seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop(); await B.connectSync("ghp_good"); await B.sync(); B.stop();
    setQty(A, "Path to Exile", 0); await A.flushSave(); A.stop();
    const A2 = await device("computer", { idb: F, ls: lsOf(A) }); A2.stop(); await both(A2, B); is(same(A2, B), "Sol×3", "removed: remove, close the app before it syncs, reopen"); A2.stop(); B.stop(); }
  { githubReset(); const A = await device("computer"), B = await device("phone"), C = await device("tablet"); seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop();
    for (const T of [B, C]) { await T.connectSync("ghp_good"); await T.sync(); T.stop(); }
    setQty(A, "Path to Exile", 0); await A.flushSave(); await both(A, B);
    C.addToColl(C.slim(bolt), "nonfoil", 1, "main"); await C.flushSave(); await C.sync(); await both(A, B); await C.sync();
    is([A, B, C].map(T => T.cards()).join(" | "), "Lightning×1, Sol×3 | Lightning×1, Sol×3 | Lightning×1, Sol×3", "removed: a third device, out of date and with a change of its own, syncs later"); A.stop(); B.stop(); C.stop(); }
  { const [A, B] = await pair(); setQty(A, "Path to Exile", 0); B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await A.flushSave(); await B.flushSave();
    await Promise.all([B.sync(), A.sync()]); await both(A, B); is(same(A, B), "Lightning×1, Sol×3", "removed: a removal while the other device uploads at the same moment"); A.stop(); B.stop(); }
  { const [A, B] = await pair(); setQty(A, "Path to Exile", 0); await A.flushSave(); GH.loseReply = true; await A.sync(); GH.loseReply = false; await both(A, B);
    is(same(A, B), "Sol×3", "removed: the removal is uploaded but the reply is lost"); A.stop(); B.stop(); }
  { const [A, B] = await pair(); const bk = JSON.parse(JSON.stringify(A.S()));
    setQty(A, "Path to Exile", 0); await A.flushSave(); await both(A, B);
    await A.restoreBackup(bk); await wait(300); while (A.SYNC.busy) await wait(30); await both(A, B);
    is(same(A, B), "Path×2, Sol×3", "removed: restoring a backup made before the removal brings the card back (as meant: a restore combines)"); A.stop(); B.stop(); }
  // the database can't be written (cards go to localStorage instead): removals must still travel both ways
  const noDb = async T => { const db = await T.idbOpen(), orig = db.transaction.bind(db); db.transaction = (s, m) => { const tx = orig(s, m); if (m === "readwrite") tx.objectStore("kv").put = () => { throw new T.w.DOMException("q", "QuotaExceededError"); }; return tx; }; };
  { const [A, B] = await pair(); await noDb(B);
    B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync();
    setQty(A, "Path to Exile", 0); await A.flushSave(); await A.sync(); await B.sync(); await A.sync();
    ok(B.idb.ok === false && same(A, B) === "Lightning×1, Sol×3", `removed, no database on one device: a removal from the other device arrives and stays (${same(A, B)})`);
    ok(!/combined, nothing removed/.test(lastLog(B, 6)), "removed, no database: …without combining everything"); A.stop(); B.stop(); }
  { const [A, B] = await pair(); await noDb(B);
    B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync();
    setQty(B, "Path to Exile", 0); await B.flushSave(); await B.sync(); await A.sync(); await B.sync();
    is(same(A, B), "Lightning×1, Sol×3", "removed, no database: a removal made on that device reaches the other one"); A.stop(); B.stop(); }
  { // …and after that device is reopened (its sync record was kept in localStorage)
    githubReset(); const F = new IDBFactory(); const A = await device("computer"), B = await device("phone", { idb: F }); seed(A); await A.connectSync("ghp_good"); await A.sync(); A.stop(); await B.connectSync("ghp_good"); await B.sync(); B.stop();
    await noDb(B); B.addToColl(B.slim(bolt), "nonfoil", 1, "main"); await B.flushSave(); await B.sync();
    ok(!!B.w.localStorage.getItem("deckhand.v1.base"), "removed, no database: the sync record is kept in localStorage");
    setQty(A, "Path to Exile", 0); await A.flushSave(); await A.sync(); const ls = lsOf(B); B.stop();
    const B2 = await device("phone", { idb: F, ls }); B2.stop(); await both(A, B2);
    ok(same(A, B2) === "Lightning×1, Sol×3" && !/combined, nothing removed|keeping everything/.test(lastLog(B2, 6)), `removed, no database, app reopened: the removal still arrives (${same(A, B2)})`); A.stop(); B2.stop(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
