// Collection dashboard: the numbers come from stored cards, tiles lead to the matching cards, nothing invented.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (id, name, set, rarity, usd) => ({ object: "card", id, oracle_id: "o" + id, name, set, set_name: set.toUpperCase() + " Set", collector_number: "1", rarity, type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: usd == null ? null : String(usd) }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } });
const CARDS = [card("a", "Alpha Mythic", "cmm", "mythic", 40), card("b", "Beta Rare", "cmm", "rare", 5), card("c", "Gamma Rare", "mh3", "rare", 12),
  card("d", "Delta Common", "mh3", "common", 0.1), card("e", "Eps Uncommon", "lci", "uncommon", null), card("w", "Wanted Mythic", "otj", "mythic", 99)];
async function run(ctxOpts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8777/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  // empty state still the welcome screen
  R.empty = await p.evaluate(() => { go("coll"); return !!document.querySelector(".welcome") && !document.querySelector("#dash"); });
  await p.evaluate(C => {
    S.binders.main = { id: "main", name: "Collection" }; S.binders.wl = { id: "wl", name: "Wishlist", wish: true };
    const [a, bb, c, d, e, w] = C.map(slim); const t0 = Date.now();
    addToColl(a, "nonfoil", 1, "main"); addToColl(bb, "nonfoil", 3, "main"); addToColl(c, "nonfoil", 2, "main"); addToColl(d, "nonfoil", 10, "main"); addToColl(e, "nonfoil", 1, "main"); addToColl(w, "nonfoil", 1, "wl");
    // known add times so "Recently added" order is checkable: Delta newest
    const at = { a: 5, b: 4, c: 3, e: 2, d: 1 }; for (const k in S.coll) { const x = S.coll[k]; if (at[x.id]) x.added = t0 - at[x.id] * 36e5; }
    const T = today(); S.hist = [{ d: T - 40, v: 100 }, { d: T - 10, v: 120 }, { d: T - 3, v: 110 }, { d: T, v: 130 }]; save(); go("coll");
  }, CARDS);
  await p.waitForTimeout(300);
  R.before = await p.evaluate(() => JSON.stringify(S.coll));
  const tiles = () => p.$$eval("#dash .tile b", a => a.map(x => x.textContent));
  R.tiles = await tiles();
  R.noPrice = await p.$eval("#dash", d => d.textContent.includes("1 card has no price"));
  R.top = await p.$$eval(".dash2 .box:first-child .mvrow .nm", a => a.map(x => x.textContent.trim().split(" ").slice(0, 2).join(" ")));
  R.recent = await p.$$eval(".dash2 .box:last-child .mvrow .nm", a => a.map(x => x.textContent.trim().split(" ").slice(0, 2).join(" ")));
  R.hist = await p.$eval("#view", v => v.textContent.replace(/\s+/g, " ").match(/7 days: \S+.*?30 days: \S+/)?.[0]);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  // Mythics tile → only mythics in the list (wishlist mythic not owned, so not shown)
  await p.click('#dash [data-dash="mythic"]'); await p.waitForTimeout(200);
  R.myth = await p.$$eval("#clist .item .name", a => a.map(x => x.textContent)); R.chip = !!(await p.$("#cfChips [data-fx=rarity]"));
  await p.click("#cfChips [data-fx=rarity]"); await p.waitForTimeout(150); R.cleared = (await p.$$("#clist .item")).length;
  await p.click('#dash [data-dash="rare"]'); await p.waitForTimeout(150); R.rare = (await p.$$eval("#clist .item .name", a => a.map(x => x.textContent))).sort();
  // Sets tile → sheet → pick MH3
  await p.click('#dash [data-dash="sets"]'); await p.waitForTimeout(200);
  R.sets = await p.$$eval("#sheetRoot [data-set]", a => a.map(x => x.dataset.set));
  await p.click('#sheetRoot [data-set="mh3"]'); await p.waitForSelector("#sdMine"); await p.click("#sdMine"); await p.waitForTimeout(300);
  R.mh3 = (await p.$$eval("#clist .item .name", a => a.map(x => x.textContent))).sort(); R.rarGone = !(await p.$("#cfChips [data-fx=rarity]"));
  await p.fill("#cq", "zzz"); await p.waitForTimeout(300); R.noMatch = await p.$eval("#clist", e => e.textContent);
  await p.fill("#cq", ""); await p.waitForTimeout(300); await p.click("#cfChips [data-fx=set]"); await p.waitForTimeout(150);
  // Most valuable "See all" → sorted by value
  await p.evaluate(() => { cv.sort = "name"; renderColl(); }); await p.click('.dash2 [data-dash="value"]'); await p.waitForTimeout(150);
  R.sort = await p.$eval("#cs", s => s.value); R.firstRow = await p.$eval("#clist .item .name", x => x.textContent);
  // Wishlist binder: its own numbers
  await p.click('#bChips [data-b="wl"]'); await p.waitForTimeout(150); R.wishTiles = await tiles();
  R.wishChart = await p.$eval("#view", v => v.textContent.includes("7 days:"));
  // short history → labelled unavailable, not guessed
  await p.evaluate(() => { cv.binder = "all"; const T = today(); S.hist = [{ d: T - 1, v: 50 }, { d: T, v: 52 }]; renderColl(); });
  R.short = await p.$eval("#view", v => (v.textContent.match(/7 days: not enough history yet/) || [])[0]);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.after = await p.evaluate(() => JSON.stringify(S.coll));
  await p.evaluate(() => flushSave && flushSave()); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(800);
  R.reload = await p.evaluate(() => [Object.keys(S.coll).length, document.querySelectorAll("#dash .tile").length]);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, "dash_desktop.png"], ["phone", devices["Pixel 7"], "dash_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.empty, `${label}: empty collection still shows the welcome screen, no empty dashboard`);
    ok(JSON.stringify(R.tiles) === JSON.stringify(["17", "5", "$80.00", "3", "5", "1"]), `${label}: tiles count owned cards only (cards, unique, value, sets, rares, mythics) ${JSON.stringify(R.tiles)}`);
    ok(R.noPrice, `${label}: cards without a price are called out, not counted as worth something`);
    ok(JSON.stringify(R.top) === JSON.stringify(["Alpha Mythic", "Gamma Rare", "Beta Rare", "Delta Common"]), `${label}: most valuable in order, unpriced card left out ${JSON.stringify(R.top)}`);
    ok(JSON.stringify(R.recent) === JSON.stringify(["Delta Common", "Eps Uncommon", "Gamma Rare", "Beta Rare", "Alpha Mythic"]), `${label}: recently added newest first ${JSON.stringify(R.recent)}`);
    ok(R.hist && /7 days: \+\$10\.00.*30 days: \+\$30\.00/.test(R.hist), `${label}: 7 and 30 day changes come from saved daily values (${R.hist})`);
    ok(JSON.stringify(R.myth) === '["Alpha Mythic"]' && R.chip && R.cleared === 5, `${label}: Mythics tile filters the list; ✕ clears it ${JSON.stringify([R.myth, R.cleared])}`);
    ok(JSON.stringify(R.rare) === '["Beta Rare","Gamma Rare"]', `${label}: Rares tile filters to rares`);
    ok(JSON.stringify(R.sets) === '["mh3","cmm","lci"]' && JSON.stringify(R.mh3) === '["Delta Common","Gamma Rare"]' && R.rarGone, `${label}: Sets sheet lists owned sets; picking one filters the list ${JSON.stringify([R.sets, R.mh3])}`);
    ok(/No cards match “zzz” with these filters/.test(R.noMatch), `${label}: empty result explains the filter`);
    ok(R.sort === "value" && R.firstRow === "Alpha Mythic", `${label}: Most valuable "See all" sorts the list by value`);
    ok(JSON.stringify(R.wishTiles) === JSON.stringify(["1", "1", "$99.00", "1", "0", "1"]) && !R.wishChart, `${label}: a wishlist shows its own numbers and no collection value chart ${JSON.stringify(R.wishTiles)}`);
    ok(!!R.short, `${label}: too little history is labelled, not guessed`);
    ok(R.before === R.after, `${label}: looking around and filtering changes no saved cards`);
    ok(R.reload[0] === 6 && R.reload[1] === 6, `${label}: after a refresh the cards and dashboard are still there ${JSON.stringify(R.reload)}`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no errors in the console ${JSON.stringify(R.errs)}`);
  }
})();
