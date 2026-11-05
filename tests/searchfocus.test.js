// Search box: after a card is found it empties and the cursor goes back, ready for the next card (Search tab and a deck's Add a card box).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, set, num, o = {}) => Object.assign({ object: "card", id: `${set}-${num}`, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, released_at: "2023-01-01", rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" }, oracle_text: "{T}: Add {C}{C}." }, o);
const ALL = [C("Sol Ring", "cmm", "410"), C("Sol Ring", "ltc", "284"), C("Forest", "dom", "266", { type_line: "Basic Land — Forest", oracle_text: "({T}: Add {G}.)" }), C("Lightning Bolt", "2x2", "117", { type_line: "Instant" }), C("Lightning Bolt", "clb", "187", { type_line: "Instant" }),
  C("Krenko, Mob Boss", "ddt", "52", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] }), C("Krenko, Mob Boss", "m13", "139", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] })];
const newest = n => ALL.filter(c => c.name === n)[0];
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8799", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], searches = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: [...new Set(ALL.map(c => c.name))] }); if (u.endsWith("/sets")) return J({ data: [] });
    let m = u.match(/named\?exact=([^&]+)/); if (m) { const c = ALL.find(c => c.name === m[1]); return c ? J(c) : J({}, 404); }
    if (u.includes("/cards/search")) { searches.push(u.split("search?")[1]); const n = (u.match(/!"([^"]+)"/) || [])[1]; const d = ALL.filter(c => !n || c.name === n); return J({ data: d, total_cards: d.length, has_more: false }); }
    if (u.includes("/cards/collection")) return J({ data: [], not_found: [] });
    return J({}, 404); });
  await p.goto("http://127.0.0.1:8799/app_real.html"); await p.waitForTimeout(600);
  const R = {}, st = () => p.evaluate(() => ({ val: document.querySelector("#sq") ? document.querySelector("#sq").value : null, focus: document.activeElement && document.activeElement.id }));
  await p.evaluate(() => { sv.mode = "search"; go("search"); }); await p.waitForTimeout(200);
  await p.click("#sq"); await p.keyboard.type("Sol R"); await p.waitForTimeout(500); await p.click("#sac button, #sac li"); await p.waitForTimeout(900);
  R.afterPick = await st(); R.label = await p.$eval("#sres", e => (e.querySelector("p") || {}).textContent || ""); R.tiles = await p.$$eval("#sres .tile", a => a.length);
  await p.selectOption("#sSort", { index: 1 }); await p.waitForTimeout(900); R.sortQ = searches.at(-1); R.sortTiles = await p.$$eval("#sres .tile", a => a.length);
  await p.click("#sres .tile button"); await p.waitForTimeout(400); R.cardOpen = await p.evaluate(() => !!document.querySelector("#sheetBody"));
  await p.click("#sheetClose"); await p.waitForTimeout(300); R.afterCard = await st(); R.tilesAfter = await p.$$eval("#sres .tile", a => a.length);
  await p.keyboard.type("Light"); await p.waitForTimeout(500); await p.click("#sac button, #sac li"); await p.waitForTimeout(900);
  R.second = await st(); R.label2 = await p.$eval("#sres", e => (e.querySelector("p") || {}).textContent || "");
  // typing a search by hand (Enter) keeps the text, so it can be tweaked
  await p.fill("#sq", "t:artifact"); await p.press("#sq", "Enter"); await p.waitForTimeout(900); R.typed = await st();
  // the deck's Add a card box: after the card screen closes, the cursor is back in the empty box
  await p.evaluate(() => { S.decks.d = { id: "d", name: "Krenko", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("decks", "d"); }); await p.waitForTimeout(300);
  await p.click("#dAdd"); await p.keyboard.type("Sol R"); await p.waitForTimeout(500); await p.click("#dAc button"); await p.waitForTimeout(800);
  R.deckSheet = await p.evaluate(() => !!document.querySelector("#sheetBody")); await p.click("#sheetClose"); await p.waitForTimeout(300);
  R.deckAfter = await p.evaluate(() => ({ val: document.querySelector("#dAdd").value, focus: document.activeElement && document.activeElement.id, n: Object.keys(S.decks.d.cards).length }));
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts);
    ok(R.afterPick.val === "" && R.tiles === 2 && /Printings of Sol Ring/.test(R.label), `[${label}] picking a name empties the box and shows its printings (${R.label})`);
    ok(R.afterPick.focus === "sq", `[${label}] cursor stays in the box for the next name (focus: ${R.afterPick.focus})`);
    ok(/!"Sol Ring"/.test(R.sortQ) && R.sortTiles === 2, `[${label}] changing the sort still sorts Sol Ring's printings (${R.sortQ})`);
    ok(R.cardOpen && R.afterCard.val === "" && R.afterCard.focus === "sq" && R.tilesAfter === 2, `[${label}] after closing the card, the box is empty with the cursor in it ${JSON.stringify(R.afterCard)}`);
    ok(R.second.val === "" && /Printings of Lightning Bolt/.test(R.label2), `[${label}] the next card can be typed straight away (${R.label2})`);
    ok(R.typed.val === "t:artifact", `[${label}] a search typed and sent with Enter keeps its text`);
    ok(R.deckSheet && R.deckAfter.val === "" && R.deckAfter.focus === "dAdd" && R.deckAfter.n === 1, `[${label}] deck's Add a card box: empty with the cursor in it after the card screen closes ${JSON.stringify(R.deckAfter)}`);
    ok(!R.errs.length, `[${label}] no errors ${JSON.stringify(R.errs)}`);
  }
})();
