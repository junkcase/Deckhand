// Sort as you scan (rules → binders) and scan straight into a deck.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8793", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script|Permission|NotAllowed|NotFound|camera/i.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8793/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade binder" }, foil: { id: "foil", name: "Foils" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    S.meta.binder = "main"; S.decks.k = { id: "k", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("scan"); });
  await p.waitForTimeout(400);
  const R = {};
  R.options = await p.$$eval("#scBinder option", a => a.map(o => o.textContent));
  // rules: rares+ at $5+ → Trade; any foil → Foils
  await p.click("#scRules summary"); await p.selectOption("#srRar", "rare"); await p.fill("#srMin", "5"); await p.selectOption("#srBin", "trade"); await p.click("#srAdd");
  await p.waitForTimeout(100); await p.check("#srFoil"); await p.selectOption("#srBin", "foil"); await p.click("#srAdd"); await p.waitForTimeout(100);
  R.empty = await p.evaluate(() => { const n = (S.settings.scanRules || []).length; document.querySelector("#srAdd").click(); return [n, (S.settings.scanRules || []).length]; });
  R.rules = await p.$$eval("#scRules .kv span.grow", a => a.map(x => x.textContent.trim()));
  if (shot) { await p.$eval("#scRules", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot }); }
  const mk = (id, name, rarity, usd, usdFoil) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity, type: "Artifact", cmc: 1, colors: [], ci: [], img: "", imgN: "", prices: { usd: String(usd), usd_foil: usdFoil == null ? null : String(usdFoil) }, finishes: ["nonfoil", "foil"], roles: [] });
  const scan = items => p.evaluate(items => { for (const [c, fin] of items) sc.items.push({ id: uid(), state: "review", card: c, finish: fin, qty: 1, at: Date.now(), exact: true }); saveSession(); drawSession(); }, items);
  await scan([[mk("cr", "Mana Crypt", "mythic", 150), "nonfoil"], [mk("so", "Sol Ring", "uncommon", 2, 6), "foil"], [mk("ti", "Rhystic Study", "rare", 4), "nonfoil"], [mk("bo", "Lightning Bolt", "uncommon", 1), "nonfoil"]]);
  await p.click("#sesAll"); await p.waitForTimeout(200);
  R.where = await p.evaluate(() => Object.values(S.coll).map(e => `${e.name}/${e.finish}→${e.binder}`).sort());
  R.toast = await p.$eval("#toastRoot", e => e.textContent);
  R.addedLines = await p.$$eval("#scSession .item .small.up", a => a.map(x => x.textContent.trim()));
  // rules off: everything to the chosen binder
  await p.uncheck("#srOn"); await scan([[mk("cr2", "Jeweled Lotus", "mythic", 60), "nonfoil"]]); await p.click("#sesAll"); await p.waitForTimeout(150);
  R.off = await p.evaluate(() => (Object.values(S.coll).find(e => e.name === "Jeweled Lotus") || {}).binder); await p.check("#srOn");
  // scan straight into a deck (and the collection)
  await p.selectOption("#scBinder", "deck:k"); await p.waitForTimeout(200);
  R.deckColl = await p.$eval("#scDeckColl", e => e.checked);
  await scan([[mk("ar", "Arcane Signet", "uncommon", 0.5), "nonfoil"], [mk("cy", "Cyclonic Rift", "rare", 30), "nonfoil"]]); await p.click("#sesAll"); await p.waitForTimeout(200);
  R.deck = await p.evaluate(() => Object.values(S.decks.k.cards).map(c => c.name).sort());
  R.deckWhere = await p.evaluate(() => ["Arcane Signet", "Cyclonic Rift"].map(n => (Object.values(S.coll).find(e => e.name === n) || {}).binder));
  // deck only (not the collection)
  await p.uncheck("#scDeckColl"); await scan([[mk("cm", "Command Tower", "common", 0.2), "nonfoil"]]); await p.click("#sesAll"); await p.waitForTimeout(200);
  R.deckOnly = await p.evaluate(() => [!!Object.values(S.decks.k.cards).find(c => c.name === "Command Tower"), !Object.values(S.coll).find(e => e.name === "Command Tower")]);
  // undo takes it out of both places
  await p.check("#scDeckColl"); await scan([[mk("ex", "Exotic Orchard", "rare", 0.5), "nonfoil"]]); await p.click("#sesAll"); await p.waitForTimeout(150);
  const id = await p.evaluate(() => sc.items.find(i => i.card.name === "Exotic Orchard").id); await p.click(`[data-undo="${id}"]`); await p.waitForTimeout(150);
  R.undo = await p.evaluate(() => [!Object.values(S.decks.k.cards).find(c => c.name === "Exotic Orchard"), !Object.values(S.coll).find(e => e.name === "Exotic Orchard")]);
  // back to a binder; reorder and delete rules
  await p.selectOption("#scBinder", "main"); await p.waitForTimeout(150);
  R.backToBinder = await p.evaluate(() => [S.meta.scanDeck, S.meta.binder]);
  await p.click('#scRules [data-srup]'); await p.waitForTimeout(100); R.order = await p.$$eval("#scRules .kv span.grow", a => a.map(x => x.textContent.trim()));
  await p.click('#scRules [data-srdel]'); await p.waitForTimeout(100); R.afterDel = await p.$$eval("#scRules .kv span.grow", a => a.length);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "scansort_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.options.join("|") === "Collection|Trade binder|Foils|Wishlist|Deck: Kiora", `binders and decks to scan into ${JSON.stringify(R.options)}`);
    ok(JSON.stringify(R.rules) === JSON.stringify(["1. Rares and mythics, $5.00 or more → Trade binder", "2. Any card, foil → Foils"]), `rules read plainly ${JSON.stringify(R.rules)}`);
    ok(R.empty[0] === R.empty[1], "a rule with no condition isn't added");
    ok(JSON.stringify(R.where) === JSON.stringify(["Lightning Bolt/nonfoil→main", "Mana Crypt/nonfoil→trade", "Rhystic Study/nonfoil→main", "Sol Ring/foil→foil"]), `first matching rule decides; $4 rare and the rest go to the chosen binder ${JSON.stringify(R.where)}`);
    ok(/1 to Trade binder/.test(R.toast) && /1 to Foils/.test(R.toast) && /2 to Collection/.test(R.toast), `the summary says where they went (${R.toast})`);
    ok(R.addedLines.some(t => /Trade binder \(rule\)/.test(t)), "each added card shows its binder and that a rule sent it");
    ok(R.off === "main", "rules switched off: everything to the chosen binder");
    ok(R.deckColl && JSON.stringify(R.deck) === '["Arcane Signet","Cyclonic Rift"]' && JSON.stringify(R.deckWhere) === '["main","trade"]', `into a deck, and the collection too, with rules applied ${JSON.stringify([R.deck, R.deckWhere])}`);
    ok(R.deckOnly.every(Boolean), "deck only, when “also add to my collection” is off");
    ok(R.undo.every(Boolean), "Undo takes it out of the deck and the collection");
    ok(R.backToBinder[0] === null && R.backToBinder[1] === "main", "switching back to a binder stops adding to the deck");
    ok(R.order[0].startsWith("1. Any card, foil") && R.afterDel === 1, "rules can be moved up and deleted");
    ok(!R.overflow, "no sideways scrolling");
    ok(!R.errs.length, `no console errors ${JSON.stringify(R.errs)}`);
  }
})();
