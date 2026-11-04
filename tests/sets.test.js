// Set completion: progress per set (main set vs everything), sorting, missing cards, wishlist, copy, show my cards.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (set, num, rarity, usd, name) => ({ object: "card", id: `${set}-${num}`, oracle_id: "o" + set + num, name: name || `${set.toUpperCase()} Card ${num}`, set, set_name: set.toUpperCase() + " Set", collector_number: String(num), rarity, type_line: "Creature", cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: usd == null ? null : String(usd) }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${set}${num}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/${set}${num}.jpg` } });
// AAA: 10 numbered cards + 2 bonus versions (11, 12); BBB: 4 cards
const AAA = [...Array(12)].map((_, i) => card("aaa", i + 1, i < 2 ? "mythic" : i < 5 ? "rare" : "common", i === 3 ? null : (i + 1) * 0.5)), BBB = [...Array(4)].map((_, i) => card("bbb", i + 1, "uncommon", 1));
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8788", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], searches = [];
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8788" });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (/\/sets(\?|$)/.test(u)) return J({ data: [{ code: "aaa", name: "Alpha Test", released_at: "2025-01-01", card_count: 12, printed_size: 10, set_type: "expansion", icon_svg_uri: "https://svgs.scryfall.io/sets/aaa.svg" }, { code: "bbb", name: "Beta Test", released_at: "2024-01-01", card_count: 4, set_type: "core", icon_svg_uri: "https://svgs.scryfall.io/sets/bbb.svg" }] });
    if (u.includes("/cards/search")) { searches.push(u); const set = (u.match(/e:(\w+)/) || [])[1]; const all = set === "aaa" ? AAA : BBB;
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
  await p.click('#setsBody [data-set="aaa"]'); await p.waitForSelector("#sdLoad");
  R.head = await p.$eval("#setD", e => e.textContent.replace(/\s+/g, " "));
  await p.click("#sdLoad"); await p.waitForSelector("#sdRar");
  const miss = () => p.$$eval("#setD .list .name", a => a.map(x => x.textContent.trim()));
  R.miss = await miss(); R.sum = await p.$$eval("#setD .summary b", a => a.map(x => x.textContent)); R.pages = searches.length;
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('#sdRar [data-r="mythic"]'); await p.waitForTimeout(100); R.mythic = await miss();
  await p.click('#sdRar [data-r=""]'); await p.click('#sdAll [data-a="1"]'); await p.waitForTimeout(100); R.missAll = await miss(); await p.click('#sdAll [data-a="0"]');
  await p.click("#sdCopy"); await p.waitForTimeout(150); R.clip = await p.evaluate(() => navigator.clipboard.readText());
  await p.click("#sdWish"); await p.waitForTimeout(150); R.wish = await p.evaluate(() => Object.values(S.coll).filter(e => e.binder === "wish").map(e => e.collector_number || e.num).sort((a, b) => a - b).join(","));
  await p.click("#sdWish"); await p.waitForTimeout(150); R.wishToast = await p.$eval("#toastRoot", e => e.textContent);
  await p.click("#sdMine"); await p.waitForTimeout(300); R.mine = await p.$$eval("#clist .item .name", a => a.length); R.chip = await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.dataset.fx).join());
  await p.click('#dash [data-dash="sets"]'); await p.waitForSelector("#setsBody .setrow"); await p.click('#setsBody [data-set="bbb"]'); await p.click("#sdLoad"); await p.waitForTimeout(400);
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
    ok(R.clip.split("\n")[0] === "1 AAA Card 2 (AAA) 2" && R.clip.split("\n").length === 6, `${label}: copy list with set and number ${JSON.stringify(R.clip.split("\n")[0])}`);
    ok(R.wish === "2,4,5,8,9,10" && /already/.test(R.wishToast), `${label}: wishlist gets the missing cards once (the #9 already wanted isn't doubled) (${R.wish})`);
    ok(R.mine === 6 && R.chip === "set", `${label}: Show my cards filters the collection to that set (${R.mine} entries)`);
    ok(/4 of 4 \(100%\)/.test(R.complete) && /You have every card/.test(R.complete), `${label}: a complete set says so`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
