// Deck suggestions "From my collection": the cards you own that aren't in the deck, inside the commander's colors and
// legal, ranked with the EDHREC statistics the Suggestions tab already uses; the best 50.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (name, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: "" }, o);
const CARDS = [
  C("Krenko, Mob Boss", { type_line: "Legendary Creature — Goblin Warrior", cmc: 4 }), C("Goblin Warchief", { type_line: "Creature — Goblin Warrior", cmc: 3 }), C("Skirk Prospector", { type_line: "Creature — Goblin" }),
  C("Sol Ring", { type_line: "Artifact", colors: [], color_identity: [] }), C("Lightning Bolt"), C("Impact Tremors", { type_line: "Enchantment", cmc: 2 }), C("Shock"),
  C("Swords to Plowshares", { colors: ["W"], color_identity: ["W"] }), C("Mana Crypt", { type_line: "Artifact", colors: [], color_identity: [], legalities: { commander: "banned", modern: "not_legal" } }),
  C("Blasphemous Act", { type_line: "Sorcery", cmc: 9 }), C("Mountain", { type_line: "Basic Land — Mountain", colors: [], cmc: 0, mana_cost: "" }), C("Goblin Token", { type_line: "Token Creature — Goblin", layout: "token" }),
  ...Array.from({ length: 60 }, (_, i) => C("Filler " + String(i + 1).padStart(2, "0"), { type_line: "Sorcery", cmc: 6 })),
];
const card = (n, num, pot, syn) => ({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: pot, synergy: syn });
const EDH = {
  "commanders/krenko-mob-boss": { container: { json_dict: { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [card("Goblin Warchief", 39364, 44998, 0.72), card("Skirk Prospector", 28000, 44998, 0.55), card("Lightning Bolt", 20000, 44998, 0.2), card("Sol Ring", 40000, 44998, 0.01), card("Swords to Plowshares", 100, 44998, -0.1), card("Mana Crypt", 3000, 44998, 0.02), card("Blasphemous Act", 15000, 44998, 0.1), card("Filler 07", 9000, 44998, 0.05)] }] } } },
  "tags/goblins": { container: { json_dict: { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [card("Impact Tremors", 9000, 20000, 0.3), card("Goblin Warchief", 15000, 20000, 0.6)] }] } } },
};
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], M = { edhDown: false, sf: 0 };
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => { if (M.edhDown) return r.abort("failed"); const k = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); return EDH[k] ? r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(EDH[k]) }) : r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { M.sf++; const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => CARDS.find(c => c.name === i.name || c.id === i.id)).filter(Boolean), not_found: [] }); }
    return J({ data: [] }, u.includes("/cards/search") ? 200 : 404); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8900/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(CARDS => {
    const by = Object.fromEntries(CARDS.map(c => [c.name, c])); S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    for (const c of CARDS) { if (/Krenko|Blasphemous/.test(c.name)) continue; addToColl(slim(c), "nonfoil", c.name === "Sol Ring" ? 2 : 1, "main", true); }
    addToColl(slim(by["Sol Ring"]), "nonfoil", 1, "main", true);                                  // a second lot of a card you already own
    addToColl(slim(by["Blasphemous Act"]), "nonfoil", 1, "wish", true);                           // only on the wishlist: not owned
    const k = { id: "k", name: "Goblins!", format: "commander", cmdr: [], cards: {}, themes: ["Goblins"], created: 1, updated: 2 }; S.decks.k = k;
    addToDeck(k, by["Krenko, Mob Boss"], 1, false, true); k.cmdr = [Object.keys(k.cards)[0]]; addToDeck(k, by["Lightning Bolt"], 1, false, true);
    const m = { id: "m", name: "Modern pile", format: "modern", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.m = m; addToDeck(m, by["Shock"], 4, false, true);
    save(); go("decks", "k");
  }, CARDS);
  await p.waitForSelector("#dTabs"); const before = await p.evaluate(() => JSON.stringify([S.coll, S.decks]));
  await p.click('#dTabs [data-t="suggest"]'); await p.waitForSelector("#rPool"); await p.waitForTimeout(900);
  const names = () => p.$$eval("#rList .item .name", a => a.map(x => x.textContent));
  ok(await p.$eval('#rPool [data-p="all"]', e => e.getAttribute("aria-pressed")) === "true" && (await names()).includes("Blasphemous Act"), `${label}: the Suggestions tab opens as before, on "All cards" (which includes cards you don't own)`);
  const sfBefore = M.sf;
  await p.click('#rPool [data-p="mine"]'); await p.waitForTimeout(700);
  let n = await names(); const info = await p.$eval("#rMine", e => e.textContent.replace(/\s+/g, " ").trim());
  ok(n.length === 50 && /Top 50 of 65 cards you own/.test(info), `${label}: "From my collection" lists the best 50 of the 65 cards you own that fit (${info})`);
  ok(n.slice(0, 4).join(", ") === "Goblin Warchief, Skirk Prospector, Sol Ring, Filler 07" || n.slice(0, 4).join(", ") === "Goblin Warchief, Skirk Prospector, Filler 07, Sol Ring", `${label}: cards in the commander's statistics come first, the most played and best fitting at the top (${n.slice(0, 5).join(", ")})`);
  ok(n.indexOf("Impact Tremors") === 4, `${label}: then cards known for the deck's theme, ahead of cards no statistics mention (Impact Tremors is #${n.indexOf("Impact Tremors") + 1})`);
  ok(!n.includes("Lightning Bolt") && !n.includes("Krenko, Mob Boss"), `${label}: cards already in the deck are left out`);
  ok(!n.includes("Swords to Plowshares"), `${label}: a card outside the commander's colors is left out`);
  ok(!n.includes("Mana Crypt"), `${label}: a card banned in the format is left out`);
  ok(!n.includes("Blasphemous Act"), `${label}: a card that is only on your wishlist is not treated as owned`);
  ok(!n.includes("Mountain") && !n.includes("Goblin Token"), `${label}: basic lands and tokens aren't suggested`);
  ok(n.filter(x => x === "Sol Ring").length === 1 && /own 3/.test(await p.$eval("#rList .item:has(.name)", () => [...document.querySelectorAll("#rList .item")].find(i => i.querySelector(".name").textContent === "Sol Ring").textContent)), `${label}: a card you own several of appears once, with how many you own`);
  ok(/In 87% of 44,998 decks · synergy \+72%/.test(await p.$eval("#rList .item", e => e.textContent)) && /Not in these statistics/.test(await p.$eval("#rList .item:last-child", e => e.textContent)), `${label}: ranked cards show their statistics; the others say they aren't in them`);
  ok(M.sf === sfBefore, `${label}: nothing is looked up online for this list (the card details come from your collection)`);
  ok(await p.evaluate(b => JSON.stringify([S.coll, S.decks]) === b, before), `${label}: looking at suggestions changes neither the collection nor the decks`);
  // filters work on everything that fits, then the best 50 are shown
  await p.selectOption("#rType", "Enchantment"); await p.waitForTimeout(150);
  ok((await names()).join() === "Impact Tremors", `${label}: a type filter searches all your fitting cards (${(await names()).join()})`);
  await p.selectOption("#rType", ""); await p.waitForTimeout(150);
  // add one: it goes into the deck and leaves the list
  await p.click('#rList [data-radd="0"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => Object.values(S.decks.k.cards).some(c => c.name === "Goblin Warchief" && c.qty === 1)), `${label}: ＋ adds the card to the deck`);
  await p.click('#dTabs [data-t="suggest"]').catch(() => {}); await p.waitForTimeout(700); n = await names();
  ok(await p.$eval('#rPool [data-p="mine"]', e => e.getAttribute("aria-pressed")) === "true" && !n.includes("Goblin Warchief") && n[0] === "Skirk Prospector" && /Top 50 of 64/.test(await p.$eval("#rMine", e => e.textContent)), `${label}: …and is gone from the list, which stays on "From my collection" (${n.slice(0, 2).join(", ")})`);
  // by theme
  await p.click('#rWhich [data-w="theme"]'); await p.waitForTimeout(700); n = await names();
  ok(n[0] === "Impact Tremors" && n.length === 50, `${label}: ranked by theme instead: the theme's cards you own come first (${n.slice(0, 2).join(", ")})`);
  // back to all cards: the original list
  await p.click('#rPool [data-p="all"]'); await p.waitForTimeout(900);
  ok(!(await p.$("#rMine")) && (await names()).includes("Impact Tremors"), `${label}: "All cards" is the list it always was`);
  // a deck with no commander: no color filter, legality of its own format
  await p.evaluate(() => go("decks", "m")); await p.waitForSelector("#dTabs"); await p.click('#dTabs [data-t="suggest"]'); await p.waitForSelector("#rPool"); await p.click('#rPool [data-p="mine"]'); await p.waitForTimeout(700);
  n = await names(); const note = await p.$eval("#rList", e => e.textContent);
  ok(n.length === 50 && !n.includes("Shock") && !n.includes("Mana Crypt") && /cards you own that aren't in this deck\./.test(note.replace(/\s+/g, " ")) && /Add a theme|Choose a commander/.test(note), `${label}: a deck without a commander: no color filter, its own format's legality, and it says why nothing is ranked`);
  await p.selectOption("#rType", "Instant"); await p.waitForTimeout(150);
  ok((await names()).includes("Swords to Plowshares"), `${label}: …so a white card you own can be suggested there`);
  // EDHREC can't be reached and nothing is saved: still a list, and it says how it is ranked
  await p.evaluate(async () => { EDH.mem.clear(); for (const k of ["edh:commanders/krenko-mob-boss", "edh:tags/goblins"]) await idbSet(k, null).catch(() => {}); for (const k in recState) delete recState[k]; }); M.edhDown = true;
  await p.evaluate(() => go("decks", "k")); await p.waitForSelector("#dTabs"); await p.click('#dTabs [data-t="suggest"]'); await p.waitForSelector("#rPool"); await p.click('#rPool [data-p="mine"]'); await p.waitForTimeout(900);
  n = await names(); const t2 = (await p.$eval("#rList", e => e.textContent)).replace(/\s+/g, " ");
  ok(n.length === 50 && /couldn't be loaded, so these are ranked only by what the deck is short of/.test(t2) && !/% of/.test(t2), `${label}: without EDHREC the cards you own are still listed, it says how they're ranked, and no statistics are made up`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: fits the screen`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8900", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
