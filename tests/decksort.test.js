// Deck cards can be sorted inside each section: mana value, name, price, color, rarity. Remembered on the device.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8804", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8804/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { const cards = {}, mk = (id, name, cmc, usd, colors, rarity) => { cards[id + "|0"] = { id, name, type: "Creature — Test", set: "cmm", num: "1", qty: 1, cmc, side: false, prices: { usd: usd == null ? null : String(usd) }, colors, rarity, img: "", finishes: ["nonfoil"], leg: {}, roles: [] }; };
    mk("a", "Delta", 3, 0.5, ["R"], "common"); mk("b", "Alpha", 5, 12, ["W"], "mythic"); mk("c", "Charlie", 1, 3, ["U", "G"], "rare"); mk("e", "Bravo", 2, null, [], "uncommon"); mk("f", "Echo", 1, 1, ["G"], "uncommon");
    S.decks.d = { id: "d", name: "Sorting", format: "casual", cmdr: [], cards, created: 1, updated: 1 }; save(); go("decks", "d"); });
  await p.waitForTimeout(300);
  const names = () => p.$$eval("#dl .item .name", a => a.map(x => x.textContent.trim().split(/\s{2,}|\n/)[0]));
  const R = { orders: {} };
  R.def = await p.$eval("#dSort", e => e.value); R.orders.cmc = await names();
  for (const k of ["name", "price", "color", "rarity"]) { await p.selectOption("#dSort", k); await p.waitForTimeout(150); R.orders[k] = await names(); }
  R.saved = await p.evaluate(() => S.meta.deckSort);
  await p.evaluate(() => { go("coll"); go("decks", "d"); }); await p.waitForTimeout(200); R.kept = [await p.$eval("#dSort", e => e.value), await names()];
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts), O = R.orders, J = JSON.stringify;
    ok(R.def === "cmc" && J(O.cmc) === J(["Charlie", "Echo", "Bravo", "Delta", "Alpha"]), `${label}: default is mana value, then name ${J(O.cmc)}`);
    ok(J(O.name) === J(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]), `${label}: name A–Z ${J(O.name)}`);
    ok(J(O.price) === J(["Alpha", "Charlie", "Echo", "Delta", "Bravo"]), `${label}: price high to low, no price last ${J(O.price)}`);
    ok(J(O.color) === J(["Alpha", "Delta", "Echo", "Charlie", "Bravo"]), `${label}: color W U B R G, multicolor, colorless ${J(O.color)}`);
    ok(J(O.rarity) === J(["Alpha", "Charlie", "Bravo", "Echo", "Delta"]), `${label}: rarity mythic first ${J(O.rarity)}`);
    ok(R.saved === "rarity" && R.kept[0] === "rarity" && J(R.kept[1]) === J(O.rarity), `${label}: the choice is remembered`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
