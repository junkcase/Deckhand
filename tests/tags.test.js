// Staple / Bulk / Worth sleeving labels: while scanning, on search results, on the card screen and in the "added" toast,
// as a collection filter, and as a sort-as-you-scan rule (e.g. Bulk → Bulk box).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const RAW = (id, name, rarity, usd, er, o = {}) => Object.assign({ object: "card", id, oracle_id: "o" + id, name, set: "cmm", set_name: "Commander Masters", collector_number: "1", released_at: "2023-08-04", rarity, type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [],
  prices: { usd: usd == null ? null : String(usd), usd_foil: null }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" }, edhrec_rank: er }, o);
const CARDS = [RAW("sol", "Sol Ring", "uncommon", 1.5, 1), RAW("sig", "Arcane Signet", "common", 0.2, 3), RAW("cry", "Mana Crypt", "mythic", 150, 120), RAW("dud", "Dud Rare", "rare", 0.4, 15000),
  RAW("mid", "Middling Card", "uncommon", 0.6, 2500), RAW("chf", "Chaff", "common", 0.05, null)];
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8798", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script|Permission|NotAllowed|NotFound|camera/i.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("api.scryfall.com/cards/search")) return J({ data: CARDS, total_cards: CARDS.length, has_more: false });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8798/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  R.unit = await p.evaluate(C => C.map(c => c.name + ":" + (tagWords(slim(c)) || "-")), CARDS);
  R.foilSleeve = await p.evaluate(c => tagWords(slim(Object.assign(c, { prices: { usd: "0.10", usd_foil: "8" }, finishes: ["nonfoil", "foil"] })), "foil"), CARDS[5]);
  // scanning: labels on each scanned card; a Bulk → Bulk box rule
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" }, bulk: { id: "bulk", name: "Bulk box" }, wish: { id: "wish", name: "Wishlist", wish: true } }; S.meta.binder = "main"; save(); go("scan"); });
  await p.waitForTimeout(400);
  await p.click("#scRules summary"); await p.selectOption("#srTag", "bulk"); await p.selectOption("#srBin", "bulk"); await p.click("#srAdd"); await p.waitForTimeout(100);
  R.rule = await p.$$eval("#scRules .kv span.grow", a => a.map(x => x.textContent.trim()));
  await p.evaluate(C => { for (const c of C) sc.items.push({ id: uid(), state: "review", card: slim(c), finish: "nonfoil", qty: 1, at: Date.now(), exact: true }); saveSession(); drawSession(); }, CARDS);
  R.scanTags = await p.$$eval("#scSession .item", a => a.map(x => x.querySelector(".name").textContent + ":" + [...x.querySelectorAll(".chip[class*=tg-]")].map(c => c.textContent).join("+")).sort());
  if (shot) { await p.$eval("#scSession", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot }); }
  await p.click("#sesAll"); await p.waitForTimeout(200);
  R.where = await p.evaluate(() => Object.values(S.coll).map(e => e.name + "→" + e.binder).sort());
  // search results: a label on the picture
  await p.evaluate(() => { sv.mode = "search"; go("search"); }); await p.waitForTimeout(200);
  await p.evaluate(C => { sv.results = C; sv.next = null; sv.err = ""; drawResults(); }, CARDS); await p.waitForTimeout(200);
  R.tiles = await p.$$eval("#sres .tile", a => a.map(x => (x.querySelector(".tg") || { textContent: "-" }).textContent));
  // card screen + toast when adding by hand
  await p.click("#sres .tile button"); await p.waitForTimeout(400);
  R.cardTags = await p.$$eval("#cTags .chip", a => a.map(x => x.textContent + "|" + x.title));
  await p.click("#cPlus"); await p.waitForTimeout(150); R.toast = await p.$eval("#toastRoot", e => e.textContent);
  await p.evaluate(() => closeSheet());
  // collection filter
  R.filter = await p.evaluate(() => { const f = Object.assign(collDefaultF(), { tag: "staple" }), pr = collPred(f), list = Object.values(S.coll).filter(e => !isWish(e.binder));
    const names = t => { const q = collPred(Object.assign(collDefaultF(), { tag: t })); return [...new Set(list.filter(q).map(e => e.name))].sort().join(","); };
    return { staple: names("staple"), bulk: names("bulk"), sleeve: names("sleeve"), chip: collFilterChips(f, {}).find(x => x[0] === "tag") }; });
  await p.evaluate(() => { cv.f = collDefaultF(); cv.fOpen = true; go("coll"); }); await p.waitForTimeout(300);
  R.panelOpts = await p.$$eval('#cfp select[data-k="tag"] option', a => a.map(x => x.textContent)).catch(() => []);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "tags_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.unit.join(" ") === "Sol Ring:Top staple Arcane Signet:Top staple, Bulk Mana Crypt:Staple, Worth sleeving Dud Rare:Bulk rare Middling Card:- Chaff:Bulk", `[${label}] labels: ${R.unit.join(" · ")}`);
    ok(R.foilSleeve === "Worth sleeving", `[${label}] labels follow the finish (a $8 foil of a bulk card is worth sleeving)`);
    ok(JSON.stringify(R.rule) === '["1. Bulk → Bulk box"]', `[${label}] sort rule reads "Bulk → Bulk box" ${JSON.stringify(R.rule)}`);
    ok(JSON.stringify(R.scanTags) === JSON.stringify(["Arcane Signet:Top staple+Bulk", "Chaff:Bulk", "Dud Rare:Bulk rare", "Mana Crypt:Staple+Worth sleeving", "Middling Card:", "Sol Ring:Top staple"]), `[${label}] each scanned card shows its labels ${JSON.stringify(R.scanTags)}`);
    ok(JSON.stringify(R.where) === JSON.stringify(["Arcane Signet→bulk", "Chaff→bulk", "Dud Rare→bulk", "Mana Crypt→main", "Middling Card→main", "Sol Ring→main"]), `[${label}] bulk (and bulk rares) sorted into the Bulk box ${JSON.stringify(R.where)}`);
    ok(R.tiles.join() === "Top staple,Top staple,Staple,Bulk rare,-,Bulk", `[${label}] search results are labelled ${JSON.stringify(R.tiles)}`);
    ok(R.cardTags.length === 1 && /^Top staple\|#1 most-played in Commander/.test(R.cardTags[0]), `[${label}] card screen shows the label and why ${JSON.stringify(R.cardTags)}`);
    ok(/Added 1 Sol Ring to .* · Top staple/.test(R.toast), `[${label}] adding by hand says it's a staple (${R.toast})`);
    ok(R.filter.staple === "Arcane Signet,Mana Crypt,Sol Ring" && R.filter.bulk === "Arcane Signet,Chaff,Dud Rare" && R.filter.sleeve === "Mana Crypt" && R.filter.chip[1] === "Staples", `[${label}] collection filter ${JSON.stringify(R.filter)}`);
    ok(R.panelOpts.join("|") === "Any card|Staples|Worth sleeving ($5+)|Bulk", `[${label}] filter panel has Staple or bulk ${JSON.stringify(R.panelOpts)}`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
