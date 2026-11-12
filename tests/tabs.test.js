// Two tabs of the same browser, in real Chromium: what one tab saves must not wipe out what the other saved.
// Sync off, and Sync on against a pretend GitHub. The cards are added with the real quick-add button.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const URL_ = "http://127.0.0.1:8895/app_real.html";
const mk = (id, name) => ({ object: "card", id, oracle_id: "o-" + id, name, set: "cmm", set_name: "Commander Masters", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], released_at: "2023-08-04", prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "https://cards.scryfall.io/small/x.jpg", normal: "https://cards.scryfall.io/normal/x.jpg" } });
const SOL = mk("sol", "Sol Ring"), PATH = mk("path", "Path to Exile"), BOLT = mk("bolt", "Lightning Bolt");
// ---- a pretend GitHub (gists), shared by every browser in this test
const GH = { gists: {}, n: 0 };
async function github(r) {
  const req = r.request(), u = new URL(req.url()), m = req.method(), cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "ETag" };
  const J = (j, st = 200, h = {}) => r.fulfill({ status: st, contentType: "application/json", headers: Object.assign({}, cors, h), body: JSON.stringify(j) });
  if (m === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
  if (u.pathname === "/user") return J({ login: "tester" });
  if (u.pathname === "/gists" && m === "GET") return J(Object.values(GH.gists).map(g => ({ id: g.id, description: g.description, created_at: g.created_at })));
  if (u.pathname === "/gists" && m === "POST") { const b = JSON.parse(req.postData()), id = "g" + (++GH.n); GH.gists[id] = { id, description: b.description, files: b.files, etag: '"e' + GH.n + '"', created_at: new Date(1e12 + GH.n).toISOString() }; return J(GH.gists[id], 201); }
  const g = GH.gists[u.pathname.split("/")[2]]; if (!g) return J({}, 404);
  if (m === "PATCH") { const b = JSON.parse(req.postData()); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"'; return J({ id: g.id }); }
  if (req.headers()["if-none-match"] === g.etag) return r.fulfill({ status: 304, headers: Object.assign({ ETag: g.etag }, cors) });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
async function browser(b) {
  const c = await b.newContext({ viewport: { width: 1000, height: 800 } }); c.errs = [];
  await c.route("https://api.github.com/**", github);
  await c.route(u => /^https:/.test(u.href) && u.hostname !== "api.github.com", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  c.tab = async () => { const p = await c.newPage(); p.on("pageerror", e => c.errs.push(e.message)); await p.goto(URL_); await p.waitForTimeout(700); return p; };
  return c;
}
const cards = p => p.evaluate(() => Object.values(S.coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", "));
// what the grid on screen says (Collection tab), not just what is in memory
const quickAdd = async (p, card, times = 1) => { await p.evaluate(T => { sv.mode = "search"; go("search"); sv.results = [T]; sv.ran = true; sv.q = T.name; drawResults(); }, card); await p.waitForSelector('#sres [data-qa="0"]'); for (let i = 0; i < times; i++) await p.click('#sres [data-qa="0"]'); };
const remove = (p, name) => p.evaluate(n => { for (const k of Object.keys(S.coll)) if (S.coll[k].name === n) delete S.coll[k]; save(); }, name);
const seed = (p, list) => p.evaluate(list => { for (const [c, n] of list) addToColl(slim(c), "nonfoil", n, "main", true); save(); }, list);
const sync = p => p.evaluate(async () => { while (SYNC.busy) await new Promise(r => setTimeout(r, 30)); await syncNow(true); });
const quiet = p => p.evaluate(() => { clearInterval(SYNC.poll); SYNC.poll = null; clearTimeout(SYNC.t); });
const settle = p => p.waitForTimeout(900);

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8895", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch();
  try {
    // ---------------- Sync off ----------------
    { const c = await browser(b); const t0 = await c.tab(); await seed(t0, [[SOL, 3]]); await t0.waitForTimeout(600); await t0.close();
      const A = await c.tab(), B = await c.tab();
      await quickAdd(A, PATH, 2); await A.waitForTimeout(500);              // tab 1 adds Path ×2 and it is saved
      await A.evaluate(() => go("coll")); await A.waitForTimeout(300);     // tab 1 sits on its Collection screen
      await quickAdd(B, BOLT, 1); await settle(B);                           // tab 2 (opened before that) adds Bolt
      ok(await cards(B) === "Lightning×1, Path×2, Sol×3", `Sync off: tab 1 adds Path, tab 2 adds Bolt: tab 2 has both (${await cards(B)})`);
      ok(await cards(A) === "Lightning×1, Path×2, Sol×3", `Sync off: …and tab 1 has both without a reload (${await cards(A)})`);
      ok(/Lightning Bolt/.test(await A.evaluate(() => document.querySelector("#view").innerHTML)), "Sync off: …and tab 1's Collection screen, left open, now shows the card added in tab 2");
      await A.close(); await B.close(); const C = await c.tab();
      ok(await cards(C) === "Lightning×1, Path×2, Sol×3", `Sync off: …and both are there after closing every tab and reopening (${await cards(C)})`);
      // the same card in both tabs
      const E = await c.tab(); await quickAdd(C, SOL, 1); await C.waitForTimeout(500); await quickAdd(E, SOL, 1); await settle(E);
      ok(await cards(C) === "Lightning×1, Path×2, Sol×5" && await cards(E) === "Lightning×1, Path×2, Sol×5", `Sync off: +1 Sol Ring in each tab adds up to 5 in both (${await cards(C)} | ${await cards(E)})`);
      // one removes, the other adds
      await remove(C, "Path to Exile"); await C.waitForTimeout(500); await quickAdd(E, BOLT, 1); await settle(E);
      ok(await cards(C) === "Lightning×2, Sol×5" && await cards(E) === "Lightning×2, Sol×5", `Sync off: tab 1 removes Path, tab 2 adds a Bolt: Path stays removed, the Bolt is kept (${await cards(C)} | ${await cards(E)})`);
      // a quantity in one tab, only a setting in the other
      await C.evaluate(() => { for (const e of Object.values(S.coll)) if (e.name === "Sol Ring") e.qty = 7; save(); }); await C.waitForTimeout(500);
      await E.evaluate(() => { S.meta.scanMode = "auto"; save(); }); await settle(E);
      // both tabs save at the very same moment
      await Promise.all([C.evaluate(T => { addToColl(slim(T), "nonfoil", 1, "main"); return flushSave(); }, PATH), E.evaluate(T => { addToColl(slim(T), "nonfoil", 1, "main"); return flushSave(); }, mk("cs", "Counterspell"))]); await settle(E);
      await C.close(); await E.close(); const F = await c.tab();
      ok(await cards(F) === "Counterspell×1, Lightning×2, Path×1, Sol×7" && await F.evaluate(() => S.meta.scanMode) === "auto", `Sync off: a quantity in one tab, a setting in the other, then both saving at the same instant: all kept (${await cards(F)}, ${await F.evaluate(() => S.meta.scanMode)})`);
      // leaving a tab at once, with the other tab still open
      const G = await c.tab(); await quickAdd(G, BOLT, 1); await G.close({ runBeforeUnload: true }); await quickAdd(F, SOL, 1); await settle(F);
      await F.reload(); await F.waitForTimeout(700);
      ok(await cards(F) === "Counterspell×1, Lightning×3, Path×1, Sol×8", `Sync off: a tab closed the instant after adding a card, the other tab then saves: both kept (${await cards(F)})`);
      ok(!c.errs.length, "Sync off: no errors on any page" + (c.errs.length ? ": " + c.errs[0] : "")); await c.close(); }

    // ---------------- Sync on ----------------
    { const c = await browser(b); const t0 = await c.tab(); await seed(t0, [[SOL, 3], [PATH, 2]]); await t0.evaluate(() => connectSync("ghp_test")); await sync(t0); await t0.waitForTimeout(400); await t0.close();
      const other = await browser(b), O = await other.tab(); await O.evaluate(() => connectSync("ghp_test")); await sync(O); await quiet(O);
      ok(await cards(O) === "Path×2, Sol×3", `Sync on: a second browser (another device) starts with the same cards (${await cards(O)})`);
      const A = await c.tab(), B = await c.tab(); await quiet(A); await quiet(B); await sync(A); await sync(B);
      // tab 1's change is saved but not uploaded; tab 2 changes something, saves and syncs; both are closed
      await quickAdd(A, BOLT, 1); await A.waitForTimeout(500); await quiet(A);
      await remove(B, "Path to Exile"); await B.waitForTimeout(500); await sync(B); await settle(B);
      ok(await cards(B) === "Lightning×1, Sol×3" && await cards(A) === "Lightning×1, Sol×3", `Sync on: tab 1 adds a Bolt (not uploaded yet), tab 2 removes Path and syncs: both tabs agree (${await cards(A)} | ${await cards(B)})`);
      await A.close(); await B.close(); await sync(O);
      ok(await cards(O) === "Lightning×1, Sol×3", `Sync on: …and the other device gets both changes, although tab 1 never uploaded (${await cards(O)})`);
      // each tab syncs its own change
      const C = await c.tab(), E = await c.tab(); await quiet(C); await quiet(E); await sync(C); await sync(E);
      await quickAdd(C, SOL, 1); await C.waitForTimeout(500); await sync(C); await quickAdd(E, SOL, 1); await E.waitForTimeout(500); await sync(E); await settle(E); await sync(C); await sync(O);
      ok(await cards(C) === "Lightning×1, Sol×5" && await cards(E) === "Lightning×1, Sol×5" && await cards(O) === "Lightning×1, Sol×5", `Sync on: +1 Sol Ring in each tab, each syncing: 5 everywhere, not counted twice (${await cards(C)} | ${await cards(E)} | ${await cards(O)})`);
      // the other device removes a card; an idle pair of tabs both follow
      await remove(O, "Lightning Bolt"); await O.waitForTimeout(500); await sync(O); await sync(C); await settle(E);
      ok(await cards(C) === "Sol×5" && await cards(E) === "Sol×5", `Sync on: a removal from the other device reaches the tab that synced and the tab that didn't (${await cards(C)} | ${await cards(E)})`);
      const logs = await C.evaluate(() => (S.meta.syncLog || []).map(e => e.what).join(" / "));
      ok(!/combined, nothing removed|keeping everything|was empty/.test(logs), "Sync on: no \"keep everything\" fallback and no \"was empty\" in the sync log");
      ok(!c.errs.length && !other.errs.length, "Sync on: no errors on any page" + (c.errs.length ? ": " + c.errs[0] : "")); await c.close(); await other.close(); }
  } finally { await b.close(); srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
