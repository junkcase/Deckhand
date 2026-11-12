// Leaving the page (reload, another site, closing the tab) straight after a change, before the 250 ms save has run.
// In a real browser the database write started as the page goes is not guaranteed to finish; the change must survive anyway.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const URL_ = "http://127.0.0.1:8893/app_real.html";
const sol = { id: "sol", oracle_id: "o-sol", name: "Sol Ring", set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: {} };
const total = p => p.evaluate(() => Object.values(S.coll).reduce((a, e) => a + e.qty, 0));
async function scenario(label, leave) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-leave-"));
  const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1000, height: 800 } });
  await c.route("https://**", r => r.fulfill({ status: 404, body: "" }));
  let p = c.pages()[0] || await c.newPage();
  await p.goto(URL_); await p.waitForTimeout(800);
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 3, "main"); save(); }, sol); await p.waitForTimeout(600);      // saved and settled: 3
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 2, "main"); save(); }, sol);                                   // 5, save still pending
  p = await leave(c, p);
  await p.goto(URL_); await p.waitForTimeout(800);
  const n = await total(p);
  ok(n === 5, `${label}: the change is still there afterwards (${n} of 5 copies)`);
  // and the stray localStorage copy is tidied away once the database has it
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 1, "main"); save(); }, sol); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(800);
  ok(await total(p) === 6 && await p.evaluate(() => !localStorage.getItem("deckhand.v1")), `${label}: later saves carry on normally in the database`);
  await c.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8893", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  try {
    await scenario("reload at once", async (c, p) => { await p.reload(); return p; });
    await scenario("go to another page at once", async (c, p) => { await p.goto("about:blank"); return p; });
    await scenario("close the tab at once", async (c, p) => { const keep = await c.newPage(); await p.close({ runBeforeUnload: true }); return keep; });
  } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
