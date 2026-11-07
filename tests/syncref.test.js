// A sync that brings in changes from another device must not make edits on an open deck or card screen go missing:
// the screen keeps the deck it was drawn with, so the sync updates that same deck rather than swapping in a copy.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8806", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8806/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  const syncIn = () => p.evaluate(() => { const st = JSON.parse(JSON.stringify(pickSync(S))); st.coll["other|nonfoil|main"] = { id: "other", name: "From Other Device", set: "x", num: "1", finish: "nonfoil", qty: 1, binder: "main", prices: {}, finishes: ["nonfoil"] }; applySynced(st, "desktop"); });
  await p.evaluate(() => { const c = (id, name) => ({ id, name, type: "Instant", set: "x", num: "1", qty: 1, cmc: 1, side: false, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: {}, roles: [] });
    S.binders = { main: { id: "main", name: "Collection" } }; S.decks.d = { id: "d", name: "Deck", format: "casual", cmdr: [], cards: { "a|0": c("a", "Alpha"), "b|0": c("b", "Bravo") }, created: 1, updated: 1 }; save(); go("decks", "d"); });
  await p.waitForTimeout(300);
  // 1. a card open from the deck while a sync comes in, then + on its deck count
  await p.click('#dl [data-open="a|0"]'); await p.waitForSelector("#cDeckInc");
  await syncIn(); await p.waitForTimeout(100);
  await p.click("#cDeckInc"); await p.waitForTimeout(100); await p.click("#sheetClose"); await p.waitForTimeout(200);
  R.inc = await p.evaluate(() => [S.decks.d.cards["a|0"].qty, !!S.coll["other|nonfoil|main"]]);
  // 2. typing in the deck's Add box while a sync comes in (the page waits to redraw), then + on a card in the list
  await p.click("#dAdd"); await p.keyboard.type("zz"); await syncIn(); await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector('#dl [data-inc="b|0"]').click()); await p.waitForTimeout(200);
  R.plus = await p.evaluate(() => S.decks.d.cards["b|0"].qty);
  // 3. after a reload, the saved deck has both
  await p.evaluate(() => flushSave()); await p.reload(); await p.waitForTimeout(600);
  R.saved = await p.evaluate(() => [S.decks.d.cards["a|0"].qty, S.decks.d.cards["b|0"].qty]);
  // 4. a deck deleted on the other device still goes to the bin, and a changed deck takes the other device's version
  await p.evaluate(() => { const st = JSON.parse(JSON.stringify(pickSync(S))); st.decks.d.name = "Renamed elsewhere"; st.decks.d.cards["b|0"].qty = 4; applySynced(st, "desktop"); });
  R.remoteChange = await p.evaluate(() => [S.decks.d.name, S.decks.d.cards["b|0"].qty]);
  // 5. what the sync uploads and records isn't changed by edits made here afterwards
  R.apart = await p.evaluate(() => { const st = JSON.parse(JSON.stringify(pickSync(S))); applySynced(st, "desktop"); addToDeck(S.decks.d, S.decks.d.cards["a|0"], 1, false); addToColl(Object.assign({}, S.coll["other|nonfoil|main"]), "nonfoil", 1, "main");
    return [st.decks.d.cards["a|0"].qty, S.decks.d.cards["a|0"].qty, st.coll["other|nonfoil|main"].qty, S.coll["other|nonfoil|main"].qty]; });
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts), J = JSON.stringify;
    ok(J(R.inc) === "[2,true]", `${label}: + on a card opened from the deck still counts after a sync came in (and the synced card is there) ${J(R.inc)}`);
    ok(R.plus === 2, `${label}: + in the deck list while the Add box was in use during a sync still counts (${R.plus})`);
    ok(J(R.saved) === "[2,2]", `${label}: both are saved ${J(R.saved)}`);
    ok(J(R.remoteChange) === '["Renamed elsewhere",4]', `${label}: changes from the other device still come through ${J(R.remoteChange)}`);
    ok(J(R.apart) === "[2,3,1,2]", `${label}: the synced version stays as it was when later edits are made here, so they're uploaded next time ${J(R.apart)}`);
    ok(!R.errs.length, `${label}: no errors ${J(R.errs)}`);
  }
})();
