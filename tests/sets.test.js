// Set completion: progress per set (main set vs everything), sorting, missing cards, wishlist, copy, show my cards.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (set, num, rarity, usd, name) => ({ object: "card", id: `${set}-${num}`, oracle_id: "o" + set + num, name: name || `${set.toUpperCase()} Card ${num}`, set, set_name: set.toUpperCase() + " Set", collector_number: String(num), rarity, type_line: "Creature", cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: usd == null ? null : String(usd) }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${set}${num}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/${set}${num}.jpg` } });
// AAA: 10 numbered cards + 2 bonus versions (11, 12); BBB: 4 cards
const AAA = [...Array(12)].map((_, i) => card("aaa", i + 1, i < 2 ? "mythic" : i < 5 ? "rare" : "common", i === 3 ? null : (i + 1) * 0.5)), BBB = [...Array(4)].map((_, i) => card("bbb", i + 1, "uncommon", 1));
// #11 is a borderless version of card #2, #12 a showcase card
Object.assign(AAA[10], { name: "AAA Card 2", border_color: "borderless" }); Object.assign(AAA[11], { frame_effects: ["showcase"] });
// colors and types for the binder filters (the rest are colorless creatures)
Object.assign(AAA[0], { colors: ["W"] }); Object.assign(AAA[1], { colors: ["U", "B"] }); Object.assign(AAA[4], { colors: ["R"], type_line: "Instant" }); Object.assign(AAA[7], { type_line: "Land" });
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8788", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], searches = [];
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8788" });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (/\/sets(\?|$)/.test(u)) return J({ data: [{ code: "aaa", name: "Alpha Test", released_at: "2025-01-01", card_count: 12, printed_size: 10, set_type: "expansion", icon_svg_uri: "https://svgs.scryfall.io/sets/aaa.svg" }, { code: "bbb", name: "Beta Test", released_at: "2024-01-01", card_count: 4, set_type: "core", icon_svg_uri: "https://svgs.scryfall.io/sets/bbb.svg" }, { code: "ccc", name: "Gamma Test", released_at: "2026-01-01", card_count: 4, printed_size: 4, set_type: "expansion", icon_svg_uri: "https://svgs.scryfall.io/sets/ccc.svg" }] });
    if (u.includes("/cards/search")) { searches.push(u); const set = (u.match(/e:(\w+)/) || [])[1]; const all = set === "aaa" ? AAA : set === "ccc" ? BBB.map(c => Object.assign({}, c, { id: "ccc-" + c.collector_number, set: "ccc" })) : BBB;
      if (u.includes("page=2")) return J({ object: "list", data: all.slice(8), has_more: false }); return J({ object: "list", data: all.slice(0, 8), has_more: all.length > 8, next_page: "https://api.scryfall.com/cards/search?q=e%3A" + set + "&page=2" }); }
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8788/app_real.html"); await p.waitForTimeout(600);
  await p.evaluate(([A, B]) => { S.binders = { main: { id: "main", name: "Collection" }, tr: { id: "tr", name: "Trade" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    for (const i of [0, 2, 5, 6]) addToColl(slim(A[i]), "nonfoil", 1, "main");             // AAA #1, #3, #6, #7
    addToColl(slim(A[2]), "foil", 2, "tr"); addToColl(slim(A[10]), "nonfoil", 1, "main");  // #3 again (foil, other binder) and bonus #11
    addToColl(slim(A[8]), "nonfoil", 1, "wish");                                           // #9 only wished for
    for (const c of B) addToColl(slim(c), "nonfoil", 1, "main");                            // BBB complete
    save(); go("coll"); }, [AAA, BBB]);
  await p.waitForTimeout(400);
  const R = {}, rows = () => p.$$eval("#setsBody .setrow", a => a.map(x => x.querySelector(".nm").textContent.replace(/\s+/g, " ").trim() + " | " + ((x.querySelector(".setbar .num") || {}).textContent || "")));
  await p.click('#dash [data-dash="sets"]'); await p.waitForSelector("#setsBody .setrow");
  R.def = await rows();
  await p.click('#setSort [data-s="done"]'); await p.waitForTimeout(100); R.done = await rows();
  await p.click('#setAll [data-a="1"]'); await p.waitForTimeout(100); R.every = await rows(); await p.click('#setAll [data-a="0"]');
  if (shot) await p.screenshot({ path: __dirname + "/" + shot.replace(".png", "_list.png") });
  await p.click('#setsBody [data-set="aaa"]'); await p.waitForSelector("#sdBind");
  R.head = await p.$eval("#setD", e => e.textContent.replace(/\s+/g, " "));
  await p.click('#sdTab [data-t="miss"]'); await p.waitForSelector("#sdRar");
  const miss = () => p.$$eval("#setD .list .name", a => a.map(x => x.textContent.trim()));
  R.miss = await miss(); R.sum = await p.$$eval("#setD .summary b", a => a.map(x => x.textContent)); R.pages = searches.length;
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('#sdRar [data-r="mythic"]'); await p.waitForTimeout(100); R.mythic = await miss();
  await p.click('#sdRar [data-r=""]');
  R.both = await p.$eval("#sdBoth", e => e.textContent.replace(/\s+/g, " ")); R.kinds = await p.$eval("#sdKinds", e => e.textContent.replace(/\s+/g, " "));
  R.note = await p.$eval('#setD [data-sc="aaa-2"]', e => e.textContent.replace(/\s+/g, " "));
  for (const [k, n] of [["u1", "under1"], ["1-5", "p1to5"], ["5-20", "p5to20"]]) { await p.click(`#sdPrice [data-p="${k}"]`); await p.waitForTimeout(80); R[n] = await miss(); R[n + "Text"] = await p.$eval("#setD", e => e.textContent); }
  await p.click('#sdPrice [data-p=""]'); await p.selectOption("#sdSort", "dear"); await p.waitForTimeout(80); R.dear = await miss();
  await p.selectOption("#sdSort", "cheap"); await p.waitForTimeout(80); R.cheap = await miss(); await p.selectOption("#sdSort", "set");
  await p.click('#sdAll [data-a="1"]'); await p.waitForTimeout(80); R.trChips = await p.$$eval("#sdTr button", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  await p.click('#sdTr [data-tr="showcase"]'); await p.waitForTimeout(80); R.showcase = await miss(); await p.click('#sdTr [data-tr=""]'); await p.click('#sdAll [data-a="0"]');
  await p.click('#sdTab [data-t="own"]'); await p.waitForTimeout(80);
  R.owned = await p.$$eval("#sdOwned .item", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim())); R.ownSum = await p.$$eval("#setD .summary b", a => a.map(x => x.textContent));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot.replace(".png", "_owned.png") });
  await p.click('#sdOwned [data-own]'); await p.waitForTimeout(300); R.opened = await p.evaluate(() => !!document.querySelector(".sheet h2, #sheet h2") && document.body.textContent.includes("AAA Card 1"));
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(150);
  await p.click('#dash [data-dash="sets"]'); await p.waitForSelector("#setsBody .setrow"); await p.click('#setsBody [data-set="aaa"]'); await p.click('#sdTab [data-t="miss"]'); await p.waitForSelector("#sdRar");
  await p.click('#sdAll [data-a="1"]'); await p.waitForTimeout(100); R.missAll = await miss(); await p.click('#sdAll [data-a="0"]');
  await p.click("#sdCopy"); await p.waitForTimeout(150); R.clip = await p.evaluate(() => navigator.clipboard.readText());
  await p.click("#sdWish"); await p.waitForTimeout(150); R.wish = await p.evaluate(() => Object.values(S.coll).filter(e => e.binder === "wish").map(e => e.collector_number || e.num).sort((a, b) => a - b).join(","));
  await p.click("#sdWish"); await p.waitForTimeout(150); R.wishToast = await p.$eval("#toastRoot", e => e.textContent);
  await p.click("#sdMine"); await p.waitForTimeout(300); R.mine = await p.$$eval("#clist .item .name", a => a.length); R.chip = await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.dataset.fx).join());
  // the binder: every card in the set, owned ones highlighted, missing ones greyed out
  await p.click('#dash [data-dash="sets"]'); await p.waitForSelector("#setsBody .setrow"); await p.click('#setsBody [data-set="aaa"]'); await p.waitForSelector("#sdGrid .bcard");
  const grid = () => p.$$eval("#sdGrid .bcard", a => a.map(x => x.querySelector(".bcap .muted").textContent.slice(1) + (x.classList.contains("own") ? "+" + x.querySelector(".bq").textContent : "-")));
  const nums = async () => (await grid()).map(x => x.replace(/[+-].*/, "")).join(",");
  const cnt = () => p.$eval("#bCount", e => e.textContent.replace(/\s+/g, " ").trim());
  R.bTab = await p.$eval('#sdTab [aria-pressed="true"]', e => e.textContent); R.bGrid = await grid(); R.bCount = await cnt();
  R.bCols = await p.$$eval("#sdGrid .bcard", a => a.filter(x => x.getBoundingClientRect().top === a[0].getBoundingClientRect().top).length);
  R.bGrey = await p.$eval("#sdGrid .bcard.miss img", e => getComputedStyle(e).filter + " " + getComputedStyle(e).opacity);
  if (shot) { await p.screenshot({ path: __dirname + "/" + shot.replace(".png", "_binder.png") }); await (await p.$("#sdGrid")).screenshot({ path: __dirname + "/" + shot.replace(".png", "_grid.png") }); }
  await p.click('#bShow [data-v="miss"]'); await p.waitForTimeout(80); R.bMiss = await nums(); await p.click('#bShow [data-v="own"]'); await p.waitForTimeout(80); R.bOwn = await nums(); await p.click('#bShow [data-v="all"]');
  R.bCol = {}; for (const c of ["W", "M", "R", "C"]) { await p.click(`#bCol [data-c="${c}"]`); await p.waitForTimeout(60); R.bCol[c] = await nums(); } await p.click('#bCol [data-c=""]');
  R.bType = {}; for (const t of ["Instant", "Land"]) { await p.selectOption("#bType", t); await p.waitForTimeout(60); R.bType[t] = await nums(); } await p.selectOption("#bType", "");
  await p.selectOption("#bRar", "mythic"); await p.waitForTimeout(60); R.bRar = await nums(); R.bRarCount = await cnt(); await p.selectOption("#bRar", "");
  await p.selectOption("#bPrice", "1-5"); await p.waitForTimeout(60); R.bPrice = await nums(); await p.selectOption("#bPrice", "");
  await p.selectOption("#bSort", "dear"); await p.waitForTimeout(60); R.bDear = (await nums()).split(",")[0]; await p.selectOption("#bSort", "set");
  await p.click("#bFrom"); await p.keyboard.type("3"); await p.click("#bTo"); await p.keyboard.type("6"); await p.waitForTimeout(80);
  R.bRange = await nums(); R.bRangeCount = await cnt(); R.bFocus = await p.evaluate(() => document.activeElement && document.activeElement.id);
  await p.fill("#bFrom", ""); await p.fill("#bTo", ""); await p.waitForTimeout(60);
  await p.click('#sdAll [data-a="1"]'); await p.waitForTimeout(80); R.bEvery = (await grid()).length; await p.selectOption("#bTr", "showcase"); await p.waitForTimeout(60); R.bShowcase = await nums();
  await p.selectOption("#bTr", ""); await p.click('#sdAll [data-a="0"]'); await p.waitForTimeout(60);
  // tap a missing card, add it, close: back in the binder with it lit up
  await p.click('#bShow [data-v="miss"]'); await p.waitForTimeout(60); await p.click('#sdGrid [data-bc="aaa-5"]'); await p.waitForSelector("#cPlus"); await p.click("#cPlus"); await p.waitForTimeout(150);
  await p.click("#sheetClose"); await p.waitForSelector("#sdGrid"); await p.waitForTimeout(100);
  R.bBack = [await p.$eval('#sdTab [aria-pressed="true"]', e => e.textContent), await p.$eval('#bShow [aria-pressed="true"]', e => e.textContent), await nums(), await cnt()];
  await p.evaluate(() => { for (const [k, e] of Object.entries(S.coll)) if (e.id === "aaa-5" && e.binder !== "wish") delete S.coll[k]; save(); });
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(100);
  // find any set, including one you have no cards from
  await p.click('#dash [data-dash="sets"]'); await p.waitForSelector("#setsBody .setrow");
  await p.click("#setFind"); await p.keyboard.type("gam"); await p.waitForTimeout(100);
  R.find = await p.$$eval("#setFindRes [data-find]", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim())); R.findFocus = await p.evaluate(() => document.activeElement.id);
  await p.fill("#setFind", "zzz"); await p.waitForTimeout(80); R.findNone = await p.$eval("#setFindRes", e => e.textContent.trim());
  await p.fill("#setFind", "gam"); await p.waitForTimeout(80); await p.click('#setFindRes [data-find="ccc"]'); await p.waitForSelector("#sdGrid .bcard");
  R.ccc = [await grid(), await cnt()];
  await p.click("#sdBack"); await p.waitForSelector("#setsBody .setrow"); await p.fill("#setFind", ""); await p.waitForTimeout(60);
  await p.click('#setsBody [data-set="bbb"]'); await p.click('#sdTab [data-t="miss"]'); await p.waitForTimeout(400);
  R.complete = await p.$eval("#setD", e => e.textContent.replace(/\s+/g, " "));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "sets_phone.png"]]) {
    const R = await run(opts, shot);
    ok(JSON.stringify(R.def) === JSON.stringify(["AAA Set AAA | 4/10", "BBB Set BBB | 4/4 ✓"]), `${label}: main-set progress counts different numbered cards in any binder, not wishlist or bonus ones ${JSON.stringify(R.def)}`);
    ok(R.done[0].startsWith("BBB Set"), `${label}: sort by most complete`);
    ok(R.every.includes("AAA Set AAA | 5/12"), `${label}: “Everything” counts the bonus versions too ${JSON.stringify(R.every)}`);
    ok(/4 of 10 \(40%\)/.test(R.head) && /Main set \(10\)/.test(R.head) && /Everything \(12\)/.test(R.head), `${label}: set page shows progress and both counts`);
    ok(JSON.stringify(R.miss) === JSON.stringify(["AAA Card 2", "AAA Card 4", "AAA Card 5", "AAA Card 8", "AAA Card 9", "AAA Card 10"]) && R.pages === 2, `${label}: missing main-set cards in order, from every page of the set (${R.pages} pages) ${JSON.stringify(R.miss)}`);
    ok(JSON.stringify(R.sum) === '["6","$17.00"]', `${label}: missing count and cost, unpriced card noted ${JSON.stringify(R.sum)}`);
    ok(JSON.stringify(R.mythic) === '["AAA Card 2"]', `${label}: rarity filter`);
    ok(R.missAll.length === 7 && R.missAll.includes("AAA Card 12"), `${label}: Everything adds missing bonus versions`);
    ok(/Main set 4\/10 \(40%\) · Every printing 5\/12 \(41%\)/.test(R.both) && /Copies and foils don't count twice/.test(R.both), `${label}: main set and every printing shown side by side ${R.both}`);
    ok(/Borderless 1\/1 · Showcase 0\/1/.test(R.kinds), `${label}: other printings counted by type ${R.kinds}`);
    ok(/You have #11 \(Borderless\)/.test(R.note), `${label}: a missing card you own in another version says so ${R.note}`);
    ok(R.under1.length === 0 && /Nothing missing with these filters/.test(R.under1Text) && JSON.stringify(R.p1to5) === JSON.stringify(["AAA Card 2", "AAA Card 5", "AAA Card 8", "AAA Card 9"]) && JSON.stringify(R.p5to20) === '["AAA Card 10"]', `${label}: price filter (unpriced cards only under Any price) ${JSON.stringify([R.under1, R.p1to5, R.p5to20])}`);
    ok(R.dear[0] === "AAA Card 10" && R.cheap[0] === "AAA Card 2" && R.dear[5] === "AAA Card 4" && R.cheap[5] === "AAA Card 4", `${label}: cheapest / most expensive first, unpriced last ${JSON.stringify([R.dear, R.cheap])}`);
    ok(JSON.stringify(R.trChips) === JSON.stringify(["All printings", "Main set 4/10", "Borderless 1/1", "Showcase 0/1"]) && JSON.stringify(R.showcase) === '["AAA Card 12"]', `${label}: printing-type filter under Everything ${JSON.stringify(R.trChips)}`);
    ok(R.owned.length === 5 && /#3 · 1 normal, 2 foil ×3/.test(R.owned[1]) && /#11 · Borderless · 1 normal ×1/.test(R.owned[4]) && !R.owned.some(x => /#9\b/.test(x)) && JSON.stringify(R.ownSum.slice(0, 2)) === '["5","7"]', `${label}: Owned tab: one row per card with quantities and finishes, wishlist left out ${JSON.stringify(R.owned)} ${JSON.stringify(R.ownSum)}`);
    ok(R.opened, `${label}: an owned row opens the card`);
    ok(R.bTab === "Binder" && JSON.stringify(R.bGrid) === JSON.stringify(["1+×1", "2-", "3+×3 ✦", "4-", "5-", "6+×1", "7+×1", "8-", "9-", "10-"]) && /^4 of 10 owned \(40%\)$/.test(R.bCount), `${label}: Binder opens first: every main-set card, owned ones with copies (✦ = has a foil), the rest missing ${JSON.stringify([R.bTab, R.bGrid, R.bCount])}`);
    ok(R.bCols >= (label === "phone" ? 3 : 5), `${label}: cards sit in a grid, ${R.bCols} per row`);
    ok(/grayscale\(1\)/.test(R.bGrey) && /0\.35$/.test(R.bGrey), `${label}: missing cards are greyed out ${R.bGrey}`);
    ok(R.bMiss === "2,4,5,8,9,10" && R.bOwn === "1,3,6,7", `${label}: show owned / missing ${R.bMiss} | ${R.bOwn}`);
    ok(JSON.stringify(R.bCol) === JSON.stringify({ W: "1", M: "2", R: "5", C: "3,4,6,7,8,9,10" }), `${label}: color filter (multicolor, colorless) ${JSON.stringify(R.bCol)}`);
    ok(JSON.stringify(R.bType) === '{"Instant":"5","Land":"8"}' && R.bRar === "1,2" && /These cards: 1 of 2 owned \(50%\)/.test(R.bRarCount), `${label}: type and rarity filters; the count follows them ${JSON.stringify([R.bType, R.bRar, R.bRarCount])}`);
    ok(R.bPrice === "2,3,5,6,7,8,9" && R.bDear === "10", `${label}: price filter and sort ${R.bPrice} ${R.bDear}`);
    ok(R.bRange === "3,4,5,6" && /These cards: 2 of 4 owned/.test(R.bRangeCount) && R.bFocus === "bTo", `${label}: collector-number range, typing isn't interrupted ${JSON.stringify([R.bRange, R.bRangeCount, R.bFocus])}`);
    ok(R.bEvery === 12 && R.bShowcase === "12", `${label}: Everything shows the bonus printings, filterable by printing type ${R.bEvery} ${R.bShowcase}`);
    ok(JSON.stringify(R.bBack) === JSON.stringify(["Binder", "Missing", "2,4,8,9,10", "5 of 10 owned (50%)"]), `${label}: add a missing card from the binder and come back to it lit up, filters kept ${JSON.stringify(R.bBack)}`);
    ok(R.find.length === 1 && /Gamma Test CCC · 2026/.test(R.find[0]) && /none yet/.test(R.find[0]) && R.findFocus === "setFind" && /No set matches/.test(R.findNone), `${label}: find any set by name, keyboard stays up ${JSON.stringify([R.find, R.findFocus, R.findNone])}`);
    ok(R.ccc[0].length === 4 && R.ccc[0].every(x => x.endsWith("-")) && /^0 of 4 owned/.test(R.ccc[1]), `${label}: a set you have none of opens fully greyed out ${JSON.stringify(R.ccc)}`);
    ok(R.clip.split("\n")[0] === "1 AAA Card 2 (AAA) 2" && R.clip.split("\n").length === 6, `${label}: copy list with set and number ${JSON.stringify(R.clip.split("\n")[0])}`);
    ok(R.wish === "2,4,5,8,9,10" && /already/.test(R.wishToast), `${label}: wishlist gets the missing cards once (the #9 already wanted isn't doubled) (${R.wish})`);
    ok(R.mine === 6 && R.chip === "set", `${label}: Show my cards filters the collection to that set (${R.mine} entries)`);
    ok(/4 of 4 \(100%\)/.test(R.complete) && /You have every card/.test(R.complete), `${label}: a complete set says so`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
