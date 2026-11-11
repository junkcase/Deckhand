// Card screen: the add controls stay in place (in the card's box, not moved to a bar at the bottom), from the collection,
// from search and after moving to the next card.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8817", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8817/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; for (let i = 0; i < 3; i++) addToColl({ id: "c" + i, name: "Card " + i, set: "tst", num: String(i), type: "Creature", prices: { usd: "2" }, finishes: ["nonfoil", "foil"] }, "nonfoil", 1, "main"); save(); go("coll"); showList(); });
  await p.waitForTimeout(300); await p.click("#clist [data-open]"); await p.waitForSelector("#cAddRow");
  const R = {};
  // [no bottom bar, the add row is inside the card's own box, the + button is in it, its place within that box (the same while scrolling)]
  const barPos = () => p.evaluate(() => { const r = document.querySelector("#cAddRow"), sh = document.querySelector("#sheetRoot .sheet"); return [!document.querySelector("#cBar, .cbar"), !!r.closest(".box"), !!r.querySelector("#cPlus"), Math.round(r.getBoundingClientRect().top - r.closest(".box").getBoundingClientRect().top)]; });
  R.atTop = await barPos();
  await p.evaluate(() => { const sh = document.querySelector("#sheetRoot .sheet"); sh.scrollTop = (sh.scrollHeight - sh.clientHeight) / 2; }); await p.waitForTimeout(150); R.mid = await barPos();
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  const name = await p.$eval("#sheetBody h2", e => e.textContent.trim());
  await p.click("#qInc"); await p.waitForTimeout(100); R.label = await p.$eval("#cPlus", e => e.textContent.trim());
  await p.click("#cPlus"); await p.waitForTimeout(200);
  R.added = await p.evaluate(n => Object.values(S.coll).filter(e => e.name === n).reduce((a, e) => a + e.qty, 0), name);
  await p.click("#cnNext"); await p.waitForTimeout(300); R.afterSwipe = [await p.$eval("#sheetBody h2", e => e.textContent.trim()) !== name, await barPos()];
  // from search results too
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  await p.evaluate(() => { sv.mode = "search"; go("search"); sv.results = [{ object: "card", id: "s1", oracle_id: "os1", name: "Search Card", set: "tst", set_name: "Test", collector_number: "9", rarity: "rare", type_line: "Creature", prices: { usd: "3" }, finishes: ["nonfoil"], image_uris: {} }]; sv.ran = true; drawResults(); });
  R.grid = await p.evaluate(() => { const tl = document.querySelector("#sres .grid.sres-big .tile"), cs = e => getComputedStyle(document.querySelector(e)); return [Math.round(tl.getBoundingClientRect().width), cs("#sres .cap").fontSize, cs("#sres .pr").fontSize, cs("#sres .qadd").width, Math.round(document.querySelector("#sres .cap .sym") ? document.querySelector("#sres .cap .sym").getBoundingClientRect().width : 18)]; });
  await p.click('#sres [data-i="0"]'); await p.waitForSelector("#cAddRow"); R.search = await barPos();
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "cardbar_phone.png"]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(R.atTop[0] && R.atTop[1] && R.atTop[2], `${label}: the add controls are in place in the card screen, not in a bar at the bottom ${J(R.atTop)}`);
    ok(R.mid[3] === R.atTop[3], `${label}: they don't move when you scroll ${J(R.mid)}`);
    ok(/^Add 2 · TST #/.test(R.label) && R.added === 3, `${label}: it still adds (2 more: ${R.label}, now ${R.added})`);
    ok(R.afterSwipe[0] && R.afterSwipe[1][0] && R.afterSwipe[1][1] && R.afterSwipe[1][2], `${label}: still in place after moving to the next card ${J(R.afterSwipe)}`);
    ok(R.grid[0] >= 150 && R.grid[1] === "14px" && R.grid[2] === "14px" && R.grid[3] === "42px" && R.grid[4] >= 18, `${label}: search results are bigger: card width, caption, price, quick add, set symbol ${J(R.grid)}`);
    ok(R.search[0] && R.search[1] && R.search[2], `${label}: in place when opened from search results too ${J(R.search)}`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
