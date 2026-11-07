// Search results: each shows its set symbol and collector number; cards you own have a green border and how many;
// + adds one more like yours (same finish, binder, condition), or one to the default binder, with Undo.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const pr = (id, set, num, finishes = ["nonfoil", "foil"]) => ({ object: "card", id, oracle_id: "o-sol", name: "Sol Ring", set, set_name: set.toUpperCase() + " Set", collector_number: num, rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], released_at: "2023-08-04",
  prices: { usd: "1.50", usd_foil: "4" }, finishes, legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/${id}.png`, normal: `https://cards.scryfall.io/${id}.png` } });
const PRINTS = [pr("sol-cmm", "cmm", "410"), pr("sol-c21", "c21", "263"), pr("sol-sld", "sld", "1512", ["foil"])];
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8825", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='5'/></svg>" }));
  await p.route("https://api.scryfall.com/sets", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ data: ["cmm", "c21", "sld"].map(c => ({ code: c, name: c, released_at: "2023-01-01", card_count: 400, set_type: "expansion", icon_svg_uri: `https://svgs.scryfall.io/sets/${c}.svg` })) }) }));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8825/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(P => { S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade binder" }, wish: { id: "wish", name: "Wishlist", wish: true } }; S.meta.binder = "main";
    addToColl(slim(P[1]), "foil", 2, "trade", true, { cond: "LP" }); addToColl(slim(P[0]), "nonfoil", 1, "wish", true); save();
    sv.mode = "search"; go("search"); return loadSets(); }, PRINTS); await p.evaluate(P => { sv.results = P; sv.ran = true; sv.q = "sol"; drawResults(); }, PRINTS);
  await p.waitForTimeout(300);
  const own = () => p.evaluate(() => Object.values(S.coll).map(e => `${e.set}#${e.num}/${e.finish}/${e.binder}${e.cond && e.cond !== "NM" ? "/" + e.cond : ""}×${e.qty}`).sort().join(","));
  const R = {};
  R.tiles = await p.$$eval("#sres .tile", a => a.map(t => [t.classList.contains("owned"), (t.querySelector(".ownq") || {}).textContent || "", t.querySelector(".cap").textContent.trim(), !!t.querySelector(".cap .sym, .cap .seticon, .cap svg, .cap i, .cap span")]));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('#sres [data-qa="1"]'); await p.waitForTimeout(200); R.dup = [await own(), await p.$eval("#toastRoot", e => e.textContent), await p.$eval("#sres .tile:nth-child(2) .ownq", e => e.textContent)];
  await p.click("#toastRoot button"); await p.waitForTimeout(200); R.undo = await own();
  await p.click('#sres [data-qa="0"]'); await p.waitForTimeout(200); R.fresh = [await own(), await p.$eval("#sres .tile:first-child", e => e.classList.contains("owned"))];
  await p.click('#sres [data-qa="2"]'); await p.waitForTimeout(200); R.foilOnly = await own();
  R.notOpened = await p.evaluate(() => !document.querySelector("#sheetRoot").innerHTML.trim());
  await p.click('#sres [data-i="0"]'); await p.waitForTimeout(300); R.open = await p.evaluate(() => !!document.querySelector("#sheetBody h2"));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "quickadd_phone.png"]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(J(R.tiles.map(t => t[2])) === '["CMM #410","C21 #263","SLD #1512"]' && R.tiles.every(t => t[3]), `${label}: under each card: set symbol and number ${J(R.tiles.map(t => t[2]))}`);
    ok(J(R.tiles.map(t => [t[0], t[1]])) === '[[false,""],[true,"×2"],[false,""]]', `${label}: a printing you own has a green border and how many (wishlist copies don't count) ${J(R.tiles)}`);
    ok(R.dup[0] === "c21#263/foil/trade/LP×3,cmm#410/nonfoil/wish×1" && /Added 1 Sol Ring \(C21 #263, foil\) to Trade binder\. You have 3/.test(R.dup[1]) && R.dup[2] === "×3", `${label}: + adds another copy just like yours ${J(R.dup)}`);
    ok(R.undo === "c21#263/foil/trade/LP×2,cmm#410/nonfoil/wish×1", `${label}: Undo takes it back (${R.undo})`);
    ok(R.fresh[0] === "c21#263/foil/trade/LP×2,cmm#410/nonfoil/main×1,cmm#410/nonfoil/wish×1" && R.fresh[1], `${label}: + on one you don't own adds one to your default binder, and it turns green ${J(R.fresh)}`);
    ok(/sld#1512\/foil\/main×1/.test(R.foilOnly), `${label}: a foil-only printing is added as foil (${R.foilOnly})`);
    ok(R.notOpened && R.open, `${label}: + doesn't open the card; tapping the card still does`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
