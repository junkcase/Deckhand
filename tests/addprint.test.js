// Adding to a deck: tapping a name uses a printing you own; "Printings" shows pictures to pick from, owned ones marked.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (id, set, num, usd, name = "Sol Ring") => ({ object: "card", id, oracle_id: "o" + name, name, set, set_name: set.toUpperCase() + " Set", collector_number: num, released_at: "2021-01-01", rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: String(usd) }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } });
const PRINTS = [C("s-cmm", "cmm", "410", 1.2), C("s-c21", "c21", "263", 0.9), C("s-lea", "lea", "270", 4000)];
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8786", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], reqs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()); reqs.push(u);
    const J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: ["Sol Ring", "Sol Talisman", "Arcane Signet"] });
    if (u.includes("/cards/search") && u.includes('!"Sol Ring"')) return J({ object: "list", data: PRINTS, has_more: false, total_cards: 3 });
    if (u.includes("/cards/named?exact=Arcane")) return J(C("sig", "cmm", "390", 0.5, "Arcane Signet"));
    if (u.includes("/cards/named?exact=Sol")) return J(PRINTS[0]);
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8786/app_real.html"); await p.waitForTimeout(600);
  await p.evaluate(P => { S.binders = { main: { id: "main", name: "Collection" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    addToColl(slim(P[1]), "nonfoil", 2, "main"); addToColl(slim(P[2]), "nonfoil", 3, "wish");             // own the C21 Sol Ring; the Alpha one is only wanted
    S.settings.openAfterAdd = false; S.decks.d = { id: "d", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("decks", "d"); }, PRINTS);
  await p.waitForTimeout(300);
  const R = {}, deck = () => p.evaluate(() => Object.values(S.decks.d.cards).map(c => `${c.qty}×${c.name}/${c.set}`).sort().join(", "));
  const type = async t => { await p.fill("#dAdd", ""); await p.click("#dAdd"); await p.keyboard.type(t); await p.waitForTimeout(400); };
  await type("sol r");
  R.items = await p.$$eval("#dAc li", a => a.map(li => [li.querySelector("[data-i]").textContent.trim(), !!li.querySelector("[data-pr]")]));
  // tap the name: uses your C21 copy, no lookup
  const before = reqs.length; await p.click('#dAc [data-i="0"]'); await p.waitForTimeout(300);
  R.tapName = await deck(); R.lookups = reqs.slice(before).filter(u => /named\?exact=Sol/.test(u)).length; R.lk = reqs.slice(before); R.toast = await p.$eval("#toastRoot", e => e.textContent);
  // a card you don't own: looked up as before
  await type("arcane"); await p.click('#dAc [data-i="0"]'); await p.waitForTimeout(500); R.notOwned = await deck();
  // Printings: pictures, owned marked, tap one to add that printing (qty from "2 sol r")
  await type("2 sol r"); await p.click('#dAc [data-pr="0"]'); await p.waitForSelector("#addPrBox .prints button", { timeout: 5000 });
  R.tiles = await p.$$eval("#addPrBox .prints button", a => a.map(x => [x.querySelector(".pl1").textContent.replace(/\s+/g, " ").trim(), (x.querySelector(".owned") || {}).textContent || ""]));
  R.pressed = await p.$$eval('#addPrBox .prints button[aria-pressed="true"]', a => a.length);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('#addPrBox .prints button[data-i="2"]'); await p.waitForTimeout(300);
  R.picked = await deck(); R.sheetClosed = !(await p.$("#addPrBox"));
  // the printing picked is now the default: tapping the name adds Alpha (not your C21 copy), and Printings starts on it
  await p.evaluate(() => { S.decks.e = { id: "e", name: "Second deck", format: "casual", cmdr: [], cards: {}, created: 2, updated: 2 }; save(); go("decks", "e"); }); await p.waitForTimeout(300);
  const b2 = reqs.length; await type("sol r"); await p.click('#dAc [data-i="0"]'); await p.waitForTimeout(300);
  R.remembered = [await p.evaluate(() => Object.values(S.decks.e.cards).map(c => `${c.qty}×${c.name}/${c.set}`).join()), reqs.slice(b2).filter(u => /named\?exact=Sol/.test(u)).length, await p.evaluate(() => !!S.settings["pp:sol ring"])];
  await type("sol r"); await p.click('#dAc [data-pr="0"]'); await p.waitForSelector("#addPrBox .prints button"); R.prePick = await p.$eval('#addPrBox .prints button[aria-pressed="true"] .pl1', e => e.textContent.replace(/\s+/g, " ").trim());
  await p.click('#addPrBox .prints button[data-i="0"]'); await p.waitForTimeout(300);
  await type("sol r"); await p.click('#dAc [data-i="0"]'); await p.waitForTimeout(300); R.changed = await p.evaluate(() => Object.values(S.decks.e.cards).map(c => `${c.qty}×${c.set}`).sort().join());
  await p.evaluate(() => go("decks", "d")); await p.waitForTimeout(200);
  // keyboard still works: arrow down + Enter picks the second suggestion
  await type("sol"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); R.hl = await p.$eval("#dAc .hl", e => e.textContent.trim()).catch(() => null);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "addprint_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.items.length >= 1 && R.items.every(x => x[1]) && /own 2/.test(R.items[0][0]), `${label}: each suggestion has a Printings button ${JSON.stringify(R.items)}`);
    ok(R.tapName === "1×Sol Ring/c21" && R.lookups === 0 && /C21 #263/.test(R.toast), `${label}: tapping a name adds the printing you own, straight away (${R.tapName}; ${R.toast}; ${R.lookups} lookups)`);
    ok(R.notOwned === "1×Arcane Signet/cmm, 1×Sol Ring/c21", `${label}: a card you don't own is looked up as before`);
    ok(JSON.stringify(R.tiles.map(t => t[1])) === '["","you own 2",""]' && R.pressed === 1, `${label}: Printings shows every printing, yours marked (wishlist copies aren't “owned”) ${JSON.stringify(R.tiles)}`);
    ok(R.picked === "1×Arcane Signet/cmm, 1×Sol Ring/c21, 2×Sol Ring/lea" && R.sheetClosed, `${label}: tapping a printing adds that one, with the quantity typed (${R.picked})`);
    ok(R.remembered[0] === "1×Sol Ring/lea" && R.remembered[1] === 0 && R.remembered[2], `${label}: the printing you picked is used next time you add that card, in any deck (no lookup) ${JSON.stringify(R.remembered)}`);
    ok(/LEA/.test(R.prePick), `${label}: the Printings list starts on the one you picked (${R.prePick})`);
    ok(R.changed === "1×lea,2×cmm", `${label}: picking another printing changes the default (${R.changed})`);
    ok(R.hl && /Sol Talisman/.test(R.hl), `${label}: arrow keys still move through the names (${R.hl})`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
