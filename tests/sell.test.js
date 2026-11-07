// Sell list: pick from the collection, price at TCGplayer / Mana Pool / Card Kingdom buylist, export, mark as sold.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const DATA = {
  "manapool/meta.json": { as_of: "2026-11-04T10:00:00Z" }, "manapool/a1.json": { "a1-crypt": [14000, 15000, 30000, null, "2xm/270/mana-crypt"] }, "manapool/b2.json": { "b2-sol": [150, 160, 500, null, "cmm/1/sol-ring"] },
  "cardkingdom/meta.json": { as_of: "2026-11-04T06:00:00Z" }, "cardkingdom/a1.json": { "a1-crypt": [11000, 22000, 2, 0, "mtg/double-masters/mana-crypt"] }, "cardkingdom/b2.json": { "b2-sol": [50, 300, 0, 4, "mtg/commander-masters/sol-ring"] },
};
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8794", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(Object.assign({ acceptDownloads: true }, opts)), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1]; r.fulfill({ status: DATA[k] ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: DATA[k] ? JSON.stringify(DATA[k]) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8794/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    const mk = (id, name, usd, foil) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "mythic", type: "Artifact", cmc: 0, colors: [], ci: [], img: "", prices: { usd: String(usd), usd_foil: foil == null ? null : String(foil) }, finishes: ["nonfoil", "foil"] });
    addToColl(mk("a1-crypt", "Mana Crypt", 150, 320), "nonfoil", 3, "main"); addToColl(mk("b2-sol", "Sol Ring", 1.5, 5), "foil", 2, "main"); addToColl(mk("c3-odd", "Odd Card", 2), "nonfoil", 1, "main");
    addToColl(mk("d4-w", "Wanted Card", 9), "nonfoil", 1, "wish"); S.meta.tradeMode = "trade"; S.trade.give = []; save(); go("trade"); });
  await p.waitForTimeout(300);
  const R = {};
  R.seg = await p.$$eval("#trMode button", a => a.map(x => x.textContent));
  await p.click('#trMode [data-m="sell"]'); await p.waitForTimeout(200);
  const add = async q => { await p.fill("#slq", q); await p.waitForTimeout(100); await p.click("#sll button"); await p.waitForTimeout(250); };
  await add("crypt"); await add("crypt"); await add("crypt"); await add("crypt"); await add("sol"); await add("odd");
  await p.fill("#slq", "wanted"); await p.waitForTimeout(100); R.wishHidden = await p.$eval("#sll", e => e.hidden || !e.children.length);
  await p.fill("#slq", ""); await p.waitForTimeout(600);
  R.qty = await p.$$eval("#sList .stepper .num", a => a.map(x => x.textContent));
  R.sum = await p.$$eval(".summary b", a => a.map(x => x.textContent)); R.mpTot = await p.$eval(".box .kv b", e => e.textContent);
  R.lines = await p.$$eval("#sList .item", a => a.map(x => x.querySelectorAll(".meta")[1].textContent.replace(/\s+/g, " ").trim()));
  R.links = await p.$$eval("#sList a", a => a.map(x => [x.textContent.trim(), x.href, x.target]));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#sCsv")]); const fs = require("fs"); R.csv = fs.readFileSync(await dl.path(), "utf8").split("\n");
  // friend trade cleared: the sell list stays
  await p.evaluate(() => { S.meta.tradeMode = "trade"; S.trade.give = [{ key: Object.keys(S.coll)[0], qty: 1 }]; save(); renderTrade(); }); await p.click("#tClear"); await p.waitForTimeout(100);
  R.kept = await p.evaluate(() => S.trade.sell.length);
  await p.click('#trMode [data-m="sell"]'); await p.waitForTimeout(200);
  await p.click("#sSold"); await p.click("#sSoldY"); await p.waitForTimeout(200);
  R.sold = await p.evaluate(() => [Object.values(S.coll).map(e => e.name + "×" + e.qty).sort().join(", "), S.trade.sell.length]);
  await p.click("#toastAct"); await p.waitForTimeout(150); R.undo = await p.evaluate(() => [Object.values(S.coll).reduce((a, e) => a + e.qty, 0), S.trade.sell.length]);
  // from Duplicates
  await p.evaluate(() => { S.trade.sell = []; save(); go("coll"); }); await p.click("#cMoreMenu > summary").then(() => p.click("#cDup")); await p.waitForTimeout(200); await p.click("#dupSell"); await p.waitForTimeout(150);
  R.fromDup = await p.evaluate(() => S.trade.sell.map(x => S.coll[x.key].name + "×" + x.qty).sort().join(", "));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "sell_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.seg.join("|") === "Trade with a friend|Sell list", "Trade tab has a Sell list next to trading with a friend");
    ok(JSON.stringify(R.qty) === '["3","1","1"]' && R.wishHidden, `adding stops at the copies you own, wishlist cards aren't offered ${JSON.stringify(R.qty)}`);
    ok(JSON.stringify(R.sum) === '["5","$457.00","$223.00"]', `totals: 5 cards, TCGplayer market, Card Kingdom cash only for what they want (2 of 3 Crypts) ${JSON.stringify(R.sum)}`);
    ok(R.mpTot === "$425.00", `Mana Pool total uses each finish's lowest listing (3×$140 + 1 foil×$5) (${R.mpTot})`);
    ok(/CK buys \$110\.00 \(wants 2\)/.test(R.lines[0]) && /Mana Pool \$5\.00/.test(R.lines[1]) && /CK buys \$3\.00/.test(R.lines[1]) && /not on Mana Pool/.test(R.lines[2]) && /CK isn't buying/.test(R.lines[2]), `each card shows all three, foil prices for foils ${JSON.stringify(R.lines)}`);
    ok(R.links.some(l => l[1] === "https://www.cardkingdom.com/mtg/double-masters/mana-crypt" && l[2] === "_blank") && R.links.some(l => l[1] === "https://manapool.com/card/2xm/270/mana-crypt"), "links to the card on Card Kingdom and Mana Pool");
    ok(R.csv[0] === "Name,Set,Number,Finish,Condition,Quantity,TCGplayer market,Mana Pool lowest,Card Kingdom buys,Card Kingdom wants" && R.csv[1] === '"Mana Crypt","CMM","1",nonfoil,NM,3,150.00,140.00,110.00,2', `CSV export ${JSON.stringify(R.csv.slice(0, 2))}`);
    ok(R.kept === 3, "clearing a friend trade keeps the sell list");
    ok(R.sold[0] === "Sol Ring×1, Wanted Card×1" && R.sold[1] === 0, `Mark as sold takes them out of the collection (${R.sold[0]})`);
    ok(R.undo[0] === 7 && R.undo[1] === 3, "and Undo puts them back");
    ok(R.fromDup === "Mana Crypt×2, Sol Ring×1", `Duplicates → Add to sell list (${R.fromDup})`);
    ok(!R.overflow, "no sideways scrolling");
    ok(!R.errs.length, `no console errors ${JSON.stringify(R.errs)}`);
  }
})();
