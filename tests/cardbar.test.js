// Card screen: the add controls sit in a bar at the bottom of the screen, in reach while scrolling and after swiping.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8817", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8817/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; for (let i = 0; i < 3; i++) addToColl({ id: "c" + i, name: "Card " + i, set: "tst", num: String(i), type: "Creature", prices: { usd: "2" }, finishes: ["nonfoil", "foil"] }, "nonfoil", 1, "main"); save(); go("coll"); showList(); });
  await p.waitForTimeout(300); await p.click("#clist [data-open]"); await p.waitForSelector("#cBar");
  const R = {};
  const barPos = () => p.evaluate(() => { const b = document.querySelector("#cBar").getBoundingClientRect(), sh = document.querySelector("#sheetRoot .sheet").getBoundingClientRect(); return [Math.round(sh.bottom - b.bottom), b.height > 30, !!document.querySelector("#cBar #cPlus")]; });
  R.atTop = await barPos();
  await p.evaluate(() => { const sh = document.querySelector("#sheetRoot .sheet"); sh.scrollTop = (sh.scrollHeight - sh.clientHeight) / 2; }); await p.waitForTimeout(150); R.mid = await barPos();
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  const name = await p.$eval("#sheetBody h2", e => e.textContent.trim());
  await p.click("#qInc"); await p.waitForTimeout(100); R.label = await p.$eval("#cPlus", e => e.textContent.trim());
  await p.click("#cPlus"); await p.waitForTimeout(200);
  R.added = await p.evaluate(n => Object.values(S.coll).filter(e => e.name === n).reduce((a, e) => a + e.qty, 0), name);
  await p.click("#cnNext"); await p.waitForTimeout(300); R.afterSwipe = [await p.$eval("#sheetBody h2", e => e.textContent.trim()) !== name, await barPos()];
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "cardbar_phone.png"]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(R.atTop[0] <= 1 && R.atTop[1] && R.atTop[2], `${label}: the add bar sits at the bottom of the card screen ${J(R.atTop)}`);
    ok(R.mid[0] <= 1, `${label}: and stays there while scrolling ${J(R.mid)}`);
    ok(/^Add 2 · TST #/.test(R.label) && R.added === 3, `${label}: it still adds (2 more: ${R.label}, now ${R.added})`);
    ok(R.afterSwipe[0] && R.afterSwipe[1][0] <= 1 && R.afterSwipe[1][2], `${label}: still there after moving to the next card ${J(R.afterSwipe)}`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
