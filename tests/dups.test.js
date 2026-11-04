// Duplicates: extra copies beyond decks + keep, most valuable kept, move to a binder, undo, copy, settings.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (id, name, usd, o = {}) => Object.assign({ object: "card", id, oracle_id: "o" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: String(usd), usd_foil: String(usd * 3) }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } }, o);
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8785", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8785" });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8785/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(Cs => {
    S.binders = { main: { id: "main", name: "Collection" }, bulk: { id: "bulk", name: "Bulk" }, trade: { id: "trade", name: "Trade binder" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    const [sol, sol2, bolt, forest, path, cs] = Cs.map(slim);
    addToColl(sol, "nonfoil", 3, "main"); addToColl(sol2, "nonfoil", 1, "bulk"); addToColl(sol, "foil", 1, "main");   // 5 Sol Rings: 3 CMM, 1 C21 ($0.80), 1 foil ($6)
    addToColl(bolt, "nonfoil", 2, "main");                                                                              // 2 Bolts, both in decks
    addToColl(forest, "nonfoil", 30, "main"); addToColl(path, "nonfoil", 3, "main"); addToColl(cs, "nonfoil", 9, "wish");
    const mk = (id, n) => S.decks[id] = { id, name: n, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
    const a = mk("a", "Ghalta"), z = mk("z", "Kiora"); addToDeck(a, sol, 1, false); addToDeck(z, sol, 1, false); addToDeck(a, bolt, 1, false); addToDeck(z, bolt, 1, false); addToDeck(a, forest, 12, false);
    save(); go("coll");
  }, [C("sol", "Sol Ring", 2), C("sol2", "Sol Ring", 0.8, { set: "c21" }), C("bolt", "Lightning Bolt", 1), C("for", "Forest", 0.05, { type_line: "Basic Land — Forest" }), C("path", "Path to Exile", 3), C("cs", "Counterspell", 1)]);
  await p.waitForTimeout(300);
  const R = {};
  const rows = () => p.$$eval("#dupBody .list .item", a => a.map(x => x.querySelector(".name").textContent.trim() + " | " + x.querySelector(".meta").textContent.trim() + " | " + x.querySelector(".price").textContent.trim()));
  await p.click("#cDup"); await p.waitForTimeout(200);
  R.def = await rows(); R.sum = await p.$$eval("#dupBody .summary b", a => a.map(x => x.textContent));
  await p.click('#dupKeep [data-k="0"]'); await p.waitForTimeout(100); R.keep0 = await rows();
  await p.click('#dupKeep [data-k="1"]'); await p.click("#dupBas"); await p.waitForTimeout(100); R.basics = await rows(); await p.click("#dupBas"); await p.waitForTimeout(100);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  R.defaultTo = await p.$eval("#dupTo", s => s.value);
  await p.click("#dupCopy"); await p.waitForTimeout(150); R.clip = await p.evaluate(() => navigator.clipboard.readText());
  // pick one, move it
  await p.click('[data-dup="Sol Ring"]'); await p.waitForTimeout(100); R.selSum = await p.$$eval("#dupBody .summary b", a => a.map(x => x.textContent));
  await p.click("#dupMove"); await p.waitForTimeout(200);
  R.after = await p.evaluate(() => Object.values(S.coll).filter(e => e.name === "Sol Ring").map(e => `${e.set}/${e.finish}/${e.binder}×${e.qty}`).sort());
  R.rowsAfter = await rows();
  await p.click("#toastAct"); await p.waitForTimeout(200);
  R.undone = await p.evaluate(() => Object.values(S.coll).filter(e => e.name === "Sol Ring" && e.binder === "trade").length);
  // one copy per deck: the 2 deck copies add up
  await p.evaluate(() => { S.settings.shareCopies = false; closeSheet(); }); await p.click("#cDup"); await p.waitForTimeout(150); R.noShare = await rows();
  await p.evaluate(() => { S.settings.shareCopies = true; closeSheet(); });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "dups_phone.png"]]) {
    const R = await run(opts, shot);
    ok(JSON.stringify(R.def) === JSON.stringify(["2× Path to Exile | own 3 · in no deck · keep 1 | $6.00", "3× Sol Ring | own 5 · 1 needed by 2 decks · keep 1 | $4.80"]),
      `${label}: extras = owned − deck use − keep; the foil is kept, the cheapest go; Bolts all used; basics and wishlist left out ${JSON.stringify(R.def)}`);
    ok(JSON.stringify(R.sum) === '["5","2","$10.80"]', `${label}: totals ${JSON.stringify(R.sum)}`);
    ok(R.keep0.some(r => /^4× Sol Ring/.test(r)) && R.keep0.some(r => /^3× Path/.test(r)), `${label}: keep 0 lists every copy beyond decks`);
    ok(R.basics.some(r => /^17× Forest/.test(r)), `${label}: basic lands only when asked (30 owned − 12 in a deck − 1)`);
    ok(R.defaultTo === "trade", `${label}: moves to the Trade binder by default`);
    ok(R.clip === "2 Path to Exile\n3 Sol Ring", `${label}: copy list ${JSON.stringify(R.clip)}`);
    ok(JSON.stringify(R.selSum) === '["3","1","$4.80"]', `${label}: tapping picks a card and the totals follow ${JSON.stringify(R.selSum)}`);
    ok(JSON.stringify(R.after) === JSON.stringify(["c21/nonfoil/trade×1", "cmm/foil/main×1", "cmm/nonfoil/main×1", "cmm/nonfoil/trade×2"]), `${label}: the 3 cheapest Sol Rings moved to Trade, the foil and one more stay ${JSON.stringify(R.after)}`);
    ok(R.rowsAfter.some(r => /^3× Sol Ring/.test(r)), `${label}: moved extras still count as extras (they're still yours), now sitting in Trade`);
    ok(R.undone === 0, `${label}: Undo puts them back`);
    ok(R.noShare.some(r => /^2× Sol Ring \| own 5 · 2 needed by 2 decks/.test(r)), `${label}: with one copy per deck, deck copies add up ${JSON.stringify(R.noShare)}`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
