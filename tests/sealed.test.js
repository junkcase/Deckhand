// Sealed products: Search → Sealed by name, the product screen (both stores, history, add, opened, remove),
// the set page's Sealed tab (with its Commander set), the collection's value split and Sealed box, offline value,
// tidy-up of bad entries and sync merging. The product list is a slice of the real data/sealed/all.json.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const ALLJ = require("./sealed_fixture.js");
const BOX = "bloomburrow play booster box", DAY = Math.floor(Date.now() / 864e5);
const HIST = { [BOX]: [[DAY - 200, 23500], [DAY - 90, 21000], [DAY - 10, 20241]] };
const SETLIST = [["blb", "Bloomburrow", "expansion", ""], ["blc", "Bloomburrow Commander", "commander", "blb"], ["dft", "Aetherdrift", "expansion", ""], ["m13", "Magic 2013", "core", ""]]
  .map(([code, name, set_type, parent]) => ({ code, name, set_type, parent_set_code: parent || undefined, released_at: "2024-08-02", card_count: 280, printed_size: 261, icon_svg_uri: `https://svgs.scryfall.io/sets/${code}.svg` }));
const SOL = { object: "card", id: "sol", oracle_id: "o-sol", name: "Sol Ring", set: "m13", set_name: "M13", collector_number: "1", rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "2.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/sol.png", normal: "https://cards.scryfall.io/sol.png" } };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8831", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 420, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  let sealedUp = true, imgs = 0;
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://tcgplayer-cdn.tcgplayer.com/**", r => { imgs++; r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='5'/></svg>" }));
  await p.route("https://raw.githubusercontent.com/**", r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*" };
    if (u.endsWith("/sealed/all.json")) return sealedUp ? r.fulfill({ status: 200, headers: H, contentType: "application/json", body: JSON.stringify(ALLJ) }) : r.abort();
    if (u.endsWith("/sealed/hist.json")) return r.fulfill({ status: 200, headers: H, contentType: "application/json", body: JSON.stringify(HIST) });
    r.fulfill({ status: 404, headers: H, body: "" }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, J = j => r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify(j) });
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (/\/sets(\?|$)/.test(u)) return J({ data: SETLIST });
    if (u.includes("/cards/search")) return J({ object: "list", has_more: false, data: [] });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8831/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(c => { S.binders = { main: { id: "main", name: "Collection" } }; S.meta.binder = "main"; addToColl(slim(c), "nonfoil", 1, "main"); save(); return loadSets(); }, SOL);
  const R = {};
  // Search → Sealed
  await p.evaluate(() => { sv.mode = "sealed"; go("search"); }); await p.waitForSelector("#slq");
  R.modes = await p.$$eval("#sMode button", a => a.map(x => x.textContent.trim()));
  await p.waitForFunction(() => /sealed products/.test(($("#slRes") || {}).textContent || ""));
  R.intro = await p.$eval("#slRes", e => e.textContent);
  await p.fill("#slq", "bloomburrow play booster"); await p.waitForTimeout(400);
  R.hits = await p.$$eval("#slRes .scard", a => a.map(x => x.title + " | " + x.querySelector(".num").textContent));
  await p.fill("#slq", "nothing like this"); await p.waitForTimeout(400); R.none = await p.$eval("#slRes", e => e.textContent);
  await p.fill("#slq", "play booster box"); await p.waitForTimeout(400);
  await p.click(`#slRes [data-sk="${BOX}"]`); await p.waitForSelector("#spMain");
  await p.waitForSelector("#spHist svg");
  R.main = await p.$eval("#spMain", e => e.textContent + " · " + e.nextElementSibling.textContent);
  R.stores = await p.$eval("#spStores", e => e.innerText.replace(/\s+/g, " "));
  R.links = await p.$$eval("#spStores a", a => a.map(x => x.href + " " + x.target));
  R.chart = await p.$eval("#spHist", e => e.textContent.replace(/\s+/g, " "));
  R.img = await p.$eval(".sprod img", e => e.src);
  await p.click('#spR [data-r="3m"]'); R.chart3 = await p.$eval("#spHist", e => e.textContent.replace(/\s+/g, " "));
  await p.screenshot({ path: __dirname + "/sealed_product.png" });
  // add 2, paid $180 each
  await p.fill("#spQty", "2"); await p.fill("#spPaid", "180"); await p.click("#spAdd"); await p.waitForTimeout(200);
  R.added = await p.evaluate(() => Object.values(S.sealed).map(e => [e.name, e.qty, e.paid, e.set, e.tcg, !!e.date, !!e.updated].join()));
  R.mine = await p.$eval("#spMine", e => e.textContent.replace(/\s+/g, " "));
  // opened one, then undo, then opened again
  await p.click("#spMine [data-so]"); await p.waitForTimeout(150);
  R.opened = await p.evaluate(() => { const e = Object.values(S.sealed)[0]; return [e.qty, e.opened, sealedTotals().value]; });
  await p.click("#toastAct"); await p.waitForTimeout(150);
  R.undo = await p.evaluate(() => { const e = Object.values(S.sealed)[0]; return [e.qty, e.opened]; });
  await p.click("#spMine [data-so]"); await p.waitForTimeout(150);
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  // set page: Sealed tab, including the Commander set's decks
  await p.evaluate(() => { sv.mode = "sets"; sv.setCode = "blb"; sv.setState = null; go("search"); }); await p.waitForSelector('#sdTab [data-t="seal"]');
  await p.click('#sdTab [data-t="seal"]'); await p.waitForSelector("#sdSeal .scard");
  R.setTab = await p.$eval('#sdTab [data-t="seal"]', e => e.textContent);
  R.setGrid = await p.$$eval("#sdSeal .scard", a => a.map(x => x.title + (x.classList.contains("own") ? " (own " + x.querySelector(".bq").textContent + ")" : "")));
  await p.screenshot({ path: __dirname + "/sealed_set.png" });
  await p.click('#sdSeal [data-sk="bloomburrow commander deck family matters"]'); await p.waitForSelector("#spMain");
  await p.click("#spAdd"); await p.waitForTimeout(150); await p.click("#sheetClose"); await p.waitForTimeout(200);
  R.backOnSet = await p.$eval('#sdTab [data-t="seal"]', e => e.getAttribute("aria-pressed"));
  // collection: value split and Sealed box
  await p.evaluate(() => { cv.binder = "all"; go("coll"); }); await p.waitForSelector("#cSealBox");
  R.value = await p.$eval("#cValue", e => e.textContent); R.split = await p.$eval("#cValSplit", e => e.textContent);
  R.box = await p.$eval("#cSealBox", e => e.textContent.replace(/\s+/g, " "));
  await p.screenshot({ path: __dirname + "/sealed_coll.png" });
  await p.click("#cSealBox"); await p.waitForSelector("#slList");
  R.sheet = [await p.$eval("#slVal", e => e.textContent), await p.$eval("#slGain", e => e.textContent), await p.$$eval("#slList .item .name", a => a.map(x => x.textContent))];
  R.openedLine = await p.$eval("#sealedAll", e => /Opened:/.test(e.textContent));
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  // binder view: sealed isn't part of one binder
  await p.evaluate(() => { cv.binder = "main"; render(); }); R.inBinder = await p.$("#cSealBox") !== null || await p.$("#cValSplit") !== null;
  // offline: the last price seen still counts
  R.offline = await p.evaluate(async () => { SEALED.list = null; SEALED.by = null; SEALED.p = null; SEALED.at = 0; return Math.round(sealedTotals().value * 100); });
  // remove + undo from the product screen
  await p.evaluate(k => openSealed(k), BOX); await p.waitForSelector("#spMine [data-sx]");
  await p.click("#spMine [data-sx]"); await p.waitForTimeout(150); R.removed = await p.evaluate(k => sealedQty(k), BOX);
  await p.click("#toastAct"); await p.waitForTimeout(150); R.restored = await p.evaluate(k => sealedQty(k), BOX);
  await p.click("#sheetClose");
  // bad entries are tidied, page code can't get in
  R.mig = await p.evaluate(() => { S.sealed.bad = { k: 5 }; S.sealed.x = { k: "a", name: "<img src=x onerror=alert(1)>", qty: "3", set: "<b>", tcg: "1;alert(1)", paid: -4, date: "soon" }; S.sealed.z = { k: "b", name: "Zero", qty: 0 }; migrate();
    const x = S.sealed.x; const r = [!!S.sealed.bad, !!S.sealed.z, x.qty, x.set, x.tcg, "paid" in x, "date" in x]; delete S.sealed.x; save(); return r; });
  // sync: purchases on two devices both survive; a change on one side wins
  R.merge = await p.evaluate(() => { const e = Object.values(S.sealed)[0], B = pickSync({ sealed: { [e.id]: e } }), L = pickSync({ sealed: { [e.id]: Object.assign({}, e, { qty: 5, updated: e.updated + 1 }), l1: { id: "l1", k: "a", name: "A", qty: 1, updated: 1 } } }), R = pickSync({ sealed: { [e.id]: e, r1: { id: "r1", k: "b", name: "B", qty: 2, updated: 1 } } });
    const m = mergeSync(B, L, R).sealed; return [m[e.id].qty, !!m.l1, !!m.r1, SYNC_KEYS.includes("sealed"), SYNC_V]; });
  // the sealed list can't load: a message, not a crash
  sealedUp = false;
  await p.evaluate(() => { SEALED.list = null; SEALED.p = null; SEALED.at = 0; SEALED.loading = false; sv.mode = "sealed"; go("search"); }); await p.waitForFunction(() => /Couldn't load sealed prices/.test(($("#slRes") || {}).textContent || ""));
  R.down = await p.$eval("#slRes", e => e.textContent);
  R.errs = errs; R.imgs = imgs;
  console.log(JSON.stringify(R, null, 1));
  ok(R.modes.join() === "Search cards,Sets,Sealed,Staples,Lists", "Search has a Sealed tab: " + R.modes.join());
  ok(/16 sealed products/.test(R.intro), "it says how many sealed products there are: " + R.intro.slice(0, 90));
  ok(R.hits.length === 3 && /Play Booster Box Case/.test(R.hits[0]) && R.hits.includes("Bloomburrow Play Booster Box | $202.41") && R.hits.every(h => /Play Booster/.test(h)), "searching by name finds the products, most valuable first, with the Mana Pool market price: " + R.hits.join(" / "));
  ok(/No sealed products match/.test(R.none), "no match says so");
  ok(R.main === "$202.41 · Mana Pool market", "product screen: the main price is Mana Pool's market price " + R.main);
  ok(/Mana Pool from \$206\.21/.test(R.stores) && /Market price \$202\.41 · 101 for sale/.test(R.stores) && /Card Kingdom \$249\.99/.test(R.stores) && /Buys at \$150\.00 \(wants 3\)/.test(R.stores), "both stores: Mana Pool lowest, market and stock; Card Kingdom price and buy price: " + R.stores);
  ok(R.links.length === 2 && R.links.every(l => / _blank$/.test(l) && /^https:\/\/(manapool|www\.cardkingdom)\.com\//.test(l)), "links to both stores open in a new tab");
  ok(/−\$32\.59 \(−13\.9%\)/.test(R.chart) && /Low \$202\.41 · High \$235\.00/.test(R.chart) && /Since /.test(R.chart3) && R.chart3 !== R.chart, "price history chart with change, low and high, and a shorter range " + R.chart.slice(0, 120) + " | " + R.chart3.slice(0, 60));
  ok(/tcgplayer-cdn\.tcgplayer\.com\/product\/541235_in_400x400\.jpg/.test(R.img) && R.imgs > 0, "product picture from TCGplayer's image server");
  ok(R.added.length === 1 && R.added[0] === "Bloomburrow Play Booster Box,2,180,blb,541235,true,true", "added 2 with what was paid and the date " + R.added);
  ok(/2 sealed · paid \$180\.00 each/.test(R.mine), "your copies show on the product screen: " + R.mine.slice(0, 80));
  ok(R.opened[0] === 1 && R.opened[1] === 1 && Math.abs(R.opened[2] - 202.41) < 0.001, "opened one: 1 sealed, 1 opened, only the sealed one counts " + R.opened);
  ok(R.undo.join() === "2,0", "undo puts it back");
  ok(/^Sealed \(12\)$/.test(R.setTab) && R.setGrid.length === 12 && R.setGrid.some(t => /Commander Deck Animated Army/.test(t)) && R.setGrid.some(t => /Play Booster Box \(own ×1\)/.test(t)) && !R.setGrid.some(t => /Aetherdrift/.test(t)), "set page Sealed tab: the set's products and its Commander set's, owned ones marked: " + R.setTab);
  ok(R.backOnSet === "true", "closing a product returns to the set's Sealed tab");
  ok(R.value === "$239.46" && R.split === "Cards $2.00 · Sealed $237.46", `collection value counts sealed, shown split: ${R.value} · ${R.split}`);
  ok(/1 opened/.test(R.box) && /\$237\.46/.test(R.box) && /Paid \$180\.00/.test(R.box) && /\+\$22\.41/.test(R.box), "collection Sealed box: count, value, paid and gain: " + R.box);
  ok(R.sheet[0] === "$237.46" && R.sheet[1] === "+$22.41" && R.sheet[2].length === 2 && R.openedLine === false, "sealed list: value, gain and each product " + JSON.stringify(R.sheet));
  ok(!R.inBinder, "a single binder's view doesn't add sealed products");
  ok(R.offline === 23746, "without the price list, the last prices seen still count (" + R.offline + ")");
  ok(R.removed === 0 && R.restored === 1, "remove, with undo");
  ok(JSON.stringify(R.mig) === JSON.stringify([false, false, 3, "", null, false, false]), "bad entries dropped or cleaned " + JSON.stringify(R.mig));
  ok(JSON.stringify(R.merge) === JSON.stringify([5, true, true, true, 5]), "sync: changes and new purchases from both devices are kept (sync version 5) " + JSON.stringify(R.merge));
  ok(/Couldn't load sealed prices/.test(R.down), "a failed price list load shows a message: " + R.down);
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
