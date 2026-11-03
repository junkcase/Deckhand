// Sync status in the header on every screen, and putting back cards a sync removed.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8782", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  let ghOk = true;
  await p.route("https://api.github.com/**", r => ghOk ? r.fulfill({ status: 304, headers: { ETag: '"e1"', "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag" } }) : r.abort("failed"));
  await p.route("https://**.scryfall.**/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8782/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  R.hiddenNoSync = await p.$eval("#syncPill", e => e.hidden);
  await p.evaluate(() => { S.binders.main = { id: "main", name: "Collection" };
    setSyncCfg({ token: "t", gist: "g", login: "junkcase" }); SYNC.base = { state: pickSync(S), at: Date.now(), id: "x" }; S.meta.syncId = "x"; SYNC.etag = '"e1"'; SYNC.lastJ = J_(pickSync(S)); SYNC.dirty = false; SYNC.at = Date.now(); syncBadge();
    S.meta.syncRemoved = [{ id: "r1", at: Date.now() - 36e5, from: "phone", cards: [{ k: "kio|nonfoil|main", id: "kio", oid: "o", name: "Kiora, the Crashing Wave", set: "bng", setName: "BNG", num: "149", rarity: "mythic", type: "Legendary Planeswalker — Kiora", cmc: 4, colors: ["G", "U"], ci: ["G", "U"], img: "", prices: { usd: "3" }, finishes: ["nonfoil"], finish: "nonfoil", qty: 2, binder: "main" }] }]; });
  const pill = () => p.$eval("#syncPill", e => [e.hidden, e.textContent, e.className]);
  R.synced = await pill();
  await p.evaluate(() => { const e = { id: "sol", oid: "o2", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "uncommon", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] }; addToColl(e, "nonfoil", 1, "main"); });
  R.saving = await pill();
  for (const t of ["decks", "search", "trade", "coll"]) { await p.evaluate(t => go(t), t); R["on_" + t] = (await pill())[0] === false; }
  await p.waitForTimeout(3500); R.after = await pill();
  ghOk = false; await p.evaluate(() => syncNow(true)); await p.waitForTimeout(3000); R.problem = await pill();
  ghOk = true; await p.evaluate(() => { SYNC.err = ""; syncBadge(); });
  await p.click("#syncPill"); await p.waitForTimeout(400);
  R.sheet = await p.$eval("#syBody", e => e.textContent.replace(/\s+/g, " "));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('[data-unrm="r1"]'); await p.waitForTimeout(200);
  R.back = await p.evaluate(() => [S.coll["kio|nonfoil|main"] && S.coll["kio|nonfoil|main"].qty, !!document.querySelector('[data-unrm="r1"]'), S.meta.syncRemoved[0].restored > 0]);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "syncui_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.hiddenNoSync, `${label}: no status shown when sync isn't set up`);
    ok(!R.synced[0] && R.synced[1] === "Synced ✓", `${label}: header shows Synced ✓ ${JSON.stringify(R.synced)}`);
    ok(R.saving[1] === "Saving…", `${label}: a change shows Saving… right away`);
    ok(R.on_decks && R.on_search && R.on_trade && R.on_coll, `${label}: the status is on every screen`);
    ok(R.after[1] === "Synced ✓", `${label}: back to Synced ✓ once sent ${JSON.stringify(R.after)}`);
    ok(/problem/i.test(R.problem[1]) && /warn/.test(R.problem[2]), `${label}: a failed sync shows a warning ${JSON.stringify(R.problem)}`);
    ok(/Removed from this .* by a sync/.test(R.sheet) && /2× Kiora/.test(R.sheet) && /every 15 seconds/.test(R.sheet), `${label}: tapping it opens Sync with what syncs removed`);
    ok(R.back[0] === 2 && !R.back[1] && R.back[2], `${label}: Put back returns the cards ${JSON.stringify(R.back)}`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
