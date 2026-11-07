// With browser storage blocked (cookies off, some private modes), every access throws. The app must still open and work
// for the session, and say that it can't save, rather than stopping on a blank screen.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8807", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  await ctx.addInitScript(() => {
    const no = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
    for (const k of ["localStorage", "sessionStorage", "indexedDB"]) Object.defineProperty(window, k, { get: no, configurable: true });
    Object.defineProperty(navigator, "standalone", { get: () => true });                        // as the installed app (the splash path)
    window.matchMedia = (q => (s => s.includes("standalone") ? { matches: true, addEventListener() {}, removeEventListener() {} } : q(s)))(window.matchMedia.bind(window));
  });
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8807/app_real.html"); await p.waitForTimeout(1500);
  const R = {};
  R.booted = await p.evaluate(() => [!!document.querySelector("#view") && document.querySelector("#view").textContent.length > 20, typeof S === "object", typeof go]);
  R.works = await p.evaluate(() => { try { addToColl({ id: "x", name: "Test Card", set: "tst", num: "1", prices: { usd: "1" }, finishes: ["nonfoil"] }, "nonfoil", 2, "main"); go("coll"); return Object.values(S.coll).reduce((a, e) => a + e.qty, 0); } catch (e) { return "threw " + e.message; } });
  await p.waitForTimeout(800); R.warn = await p.evaluate(() => (document.querySelector("#toastRoot") || {}).textContent || "");
  R.view = await p.evaluate(() => document.querySelector("#view").textContent.replace(/\s+/g, " ").slice(0, 300));
  for (const t of ["search", "decks", "market", "trade"]) await p.evaluate(t => go(t), t).catch(e => errs.push(t + ": " + e.message));
  await p.waitForTimeout(500);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts);
    ok(JSON.stringify(R.booted) === '[true,true,"function"]', `${label}: the app opens with storage blocked ${JSON.stringify(R.booted)}`);
    ok(R.works === 2, `${label}: cards can still be added for the session (${R.works})`);
    ok(/Couldn't save/.test(R.warn), `${label}: it says it can't save (${R.warn.slice(0, 80)})`);
    ok(!R.errs.length, `${label}: no errors ${JSON.stringify(R.errs)}`);
  }
})();
