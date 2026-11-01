const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" }, oracle_text: "" }, o);
const CARDS = {
  "Krenko, Mob Boss": C("Krenko, Mob Boss", { type_line: "Legendary Creature — Goblin Warrior", cmc: 4, mana_cost: "{2}{R}{R}", oracle_text: "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.", prices: { usd: "3.00" } }),
  "Atraxa, Praetors' Voice": C("Atraxa, Praetors' Voice", { type_line: "Legendary Creature — Phyrexian Angel Horror", cmc: 4, color_identity: ["W", "U", "B", "G"], colors: ["W", "U", "B", "G"], oracle_text: "Flying, vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate." }),
  "Goblin Warchief": C("Goblin Warchief", { type_line: "Creature — Goblin Warrior", cmc: 3, oracle_text: "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.", prices: { usd: "0.50" } }),
  "Skirk Prospector": C("Skirk Prospector", { type_line: "Creature — Goblin", cmc: 1, oracle_text: "Sacrifice a Goblin: Add {R}.", prices: { usd: "0.25" } }),
  "Sol Ring": C("Sol Ring", { type_line: "Artifact", colors: [], color_identity: [], oracle_text: "{T}: Add {C}{C}.", prices: { usd: "1.50" } }),
  "Lightning Bolt": C("Lightning Bolt", { oracle_text: "Lightning Bolt deals 3 damage to any target.", prices: { usd: "2.00" } }),
  "Blasphemous Act": C("Blasphemous Act", { type_line: "Sorcery", cmc: 9, oracle_text: "Blasphemous Act deals 13 damage to each creature.", prices: { usd: "4.00" } }),
  "Swords to Plowshares": C("Swords to Plowshares", { colors: ["W"], color_identity: ["W"], oracle_text: "Exile target creature.", prices: { usd: "2.00" } }),
  "Mana Crypt": C("Mana Crypt", { type_line: "Artifact", colors: [], color_identity: [], legalities: { commander: "banned" }, oracle_text: "{T}: Add {C}{C}." }),
  "Impact Tremors": C("Impact Tremors", { type_line: "Enchantment", cmc: 2, oracle_text: "Whenever a creature you control enters, Impact Tremors deals 1 damage to each opponent." }),
};
const card = (n, num, pot, syn) => ({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: pot, synergy: syn });
const EDH = {
  "commanders/krenko-mob-boss": { panels: { taglinks: [{ value: "Goblins", slug: "goblins", count: 4393 }, { value: "Tokens", slug: "tokens", count: 2662 }] },
    container: { json_dict: { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [card("Goblin Warchief", 39364, 44998, 0.72), card("Sol Ring", 40000, 44998, 0.01), card("Swords to Plowshares", 100, 44998, -0.1), card("Mana Crypt", 3000, 44998, 0.02), card("Lightning Bolt", 20000, 44998, 0.2)] },
      { header: "Creatures", tag: "creatures", cardviews: [card("Skirk Prospector", 28000, 44998, 0.55), card("Goblin Warchief", 1, 1, 0)] }, { header: "Sorceries", tag: "sorceries", cardviews: [card("Blasphemous Act", 15000, 44998, 0.1)] }] } } },
  "tags/goblins": { container: { json_dict: { cardlists: [{ header: "Top Commanders", tag: "topcommanders", cardviews: [card("Krenko, Mob Boss", 9000, 20000)] }, { header: "Top Cards", tag: "topcards", cardviews: [card("Goblin Warchief", 15000, 20000, 0.6), card("Impact Tremors", 9000, 20000, 0.3), card("Skirk Prospector", 12000, 20000, 0.5)] }] } } },
  "commanders/krenko-mob-boss/goblins": { container: { json_dict: { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [card("Impact Tremors", 3000, 4876, 0.4), card("Skirk Prospector", 4209, 4876, 0.6)] }] } } },
};
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8774", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 900 } });
  const M = { edhDown: false, edhReq: 0 }; p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://json.edhrec.com/**", route => {
    M.edhReq++; if (M.edhDown) return route.abort("failed");
    const path = new URL(route.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, "");
    return EDH[path] ? route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(EDH[path]) }) : route.fulfill({ status: 404, body: "{}" });
  });
  await p.route("https://api.scryfall.com/**", async route => {
    const u = decodeURIComponent(route.request().url()), J = (j, st = 200) => route.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: Object.keys(CARDS) });
    if (u.endsWith("/sets")) return J({ data: [] });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(route.request().postData()).identifiers; return J({ data: ids.map(i => CARDS[i.name] || Object.values(CARDS).find(c => c.id === i.id)).filter(Boolean), not_found: [] }); }
    if (u.includes("/cards/search")) {
      const q = u.match(/q=([^&]+)/)[1];
      if (/is:commander/.test(q)) return J({ data: [CARDS["Atraxa, Praetors' Voice"], CARDS["Krenko, Mob Boss"]].filter(c => !/name:/.test(q) || /krenko/i.test(q) && /Krenko/.test(c.name)), has_more: false });
      return J({ data: [CARDS["Sol Ring"], CARDS["Swords to Plowshares"], CARDS["Lightning Bolt"], CARDS["Impact Tremors"]], has_more: false });   // fallback popularity
    }
    const m = u.match(/\/cards\/(id-[\w-]+)$/); if (m) { const c = Object.values(CARDS).find(c => c.id === m[1]); return c ? J(c) : J({}, 404); }
    if (u.includes("named?exact=")) { const n = u.match(/exact=([^&]+)/)[1]; return CARDS[n] ? J(CARDS[n]) : J({ details: "not found" }, 404); }
    return J({}, 404);
  });
  await p.goto("http://127.0.0.1:8774/app_real.html"); await p.waitForTimeout(600);
  const txt = s => p.evaluate(sel => (document.querySelector(sel) || {}).textContent || "", s);
  await p.evaluate(() => { addToColl(slim({ object: "card", id: "id-lightning-bolt", oracle_id: "o", name: "Lightning Bolt", set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"], prices: { usd: "2.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" }, oracle_text: "Lightning Bolt deals 3 damage to any target." }), "nonfoil", 2, "main"); go("decks"); });
  await p.fill("#ndName", "Goblins!"); await p.selectOption("#ndFmt", "commander"); await p.click("#nd button.primary"); await p.waitForTimeout(800);
  ok(/Choose your commander/.test(await txt("#dPick")) && (await p.$$("#dPick .ctile")).length === 2, "new Commander deck: commander picker with the most popular commanders");
  await p.fill("#cpQ", "krenko"); await p.waitForTimeout(900);
  const tiles = await p.$$eval("#dPick .ctile", ts => ts.map(t => t.textContent));
  ok(tiles.length === 1 && /Krenko/.test(tiles[0]), "search narrows it to Krenko, with color shown");
  await p.click("#dPick .ctile"); await p.waitForTimeout(800);
  const deck = () => p.evaluate(() => Object.values(S.decks)[0]);
  let d = await deck();
  ok(d.cmdr.length === 1 && d.cards[d.cmdr[0]].name === "Krenko, Mob Boss", "Krenko becomes the commander");
  ok(/Goblins/.test(await txt("#dThemeSug")) && /4,393/.test(await txt("#dThemeSug")) && /EDHREC/.test(await txt("#dThemeSug")), "suggested themes from EDHREC: " + (await txt("#dThemeSug")).replace(/\s+/g, " ").trim());
  await p.click('[data-addtheme="Goblins"]'); await p.waitForTimeout(300);
  ok(JSON.stringify((await deck()).themes) === '["Goblins"]', "tap a suggested theme to add it");
  // suggestions
  await p.click('#dTabs [data-t="suggest"]'); await p.waitForTimeout(1500);
  let list = await txt("#rList");
  const names = await p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
  ok(names[0] === "Skirk Prospector" && names[1] === "Goblin Warchief", "Commander list from EDHREC, best match first; Skirk Prospector is boosted because it's ramp and the deck has none: " + names.join(", "));
  await p.selectOption("#rSort", "syn"); await p.waitForTimeout(100);
  ok((await p.$$eval("#rList .item .name", e => e.map(x => x.textContent)))[0] === "Goblin Warchief", "sort by highest synergy: Goblin Warchief (+72%) first");
  await p.selectOption("#rSort", "best"); await p.waitForTimeout(100);
  ok(!names.includes("Swords to Plowshares") && !names.includes("Mana Crypt"), "off-color (Swords) and banned (Mana Crypt) cards are left out");
  await p.screenshot({ path: "sug_phone.png", fullPage: false });
  ok(/In 87% of 44,998 decks · synergy \+72%/.test(list), "real EDHREC numbers shown: “In 87% of 44,998 decks · synergy +72%”");
  ok(/own 2/.test(list) && /Removal/.test(list), "shows that I own Lightning Bolt and its role");
  await p.selectOption("#rOwn", "own"); await p.waitForTimeout(100);
  ok(JSON.stringify(await p.$$eval("#rList .item .name", e => e.map(x => x.textContent))) === '["Lightning Bolt"]', "filter: cards I own");
  await p.selectOption("#rOwn", "all"); await p.selectOption("#rSort", "cheap"); await p.waitForTimeout(100);
  ok((await p.$$eval("#rList .item .name", e => e.map(x => x.textContent)))[0] === "Skirk Prospector", "sort: lowest price first");
  await p.selectOption("#rSort", "best"); await p.waitForTimeout(100);
  await p.evaluate(() => { const it = [...document.querySelectorAll("#rList .item")].find(x => x.querySelector(".name").textContent === "Goblin Warchief"); it.querySelector("[data-radd]").click(); }); await p.waitForTimeout(1200);
  ok(Object.values((await deck()).cards).some(c => c.name === "Goblin Warchief") && !(await p.$$eval("#rList .item .name", e => e.map(x => x.textContent))).includes("Goblin Warchief"), "＋ adds the card to the deck right there, and it leaves the list");
  await p.click('#rWhich [data-w="theme"]'); await p.waitForTimeout(1200);
  const th = await p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
  ok(th.includes("Impact Tremors") && !th.includes("Krenko, Mob Boss") && !th.includes("Goblin Warchief"), "Theme list (Goblins): " + th.join(", "));
  await p.click('#rWhich [data-w="both"]'); await p.waitForTimeout(1200);
  const both = await p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
  ok(both.slice().sort().join() === "Impact Tremors,Skirk Prospector", "Commander + theme list: " + both.join(", "));
  // balance
  await p.click('#dTabs [data-t="balance"]'); await p.waitForTimeout(400);
  const bal = await txt("#dPane");
  ok(/Ramp ?0 9–12 low/.test(bal.replace(/\s+/g, " ")), "Balance: ramp 0, flagged low against a suggested 9–12");
  await p.screenshot({ path: "bal_phone.png", fullPage: false });
  await p.click('[data-fill="Ramp"]'); await p.waitForTimeout(1500);
  const ramp = await p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
  ok((await p.evaluate(() => recState[Object.keys(S.decks)[0]].role)) === "Ramp" && ramp.every(n => ["Sol Ring", "Skirk Prospector"].includes(n)) && ramp.length > 0, "“Find ramp” opens suggestions filtered to ramp: " + ramp.join(", "));
  // role fix
  await p.click('#dTabs [data-t="balance"]'); await p.waitForTimeout(300);
  await p.click('[data-roles="Goblin Warchief"]'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#roBody input[value="Ramp"]').click()); await p.click("#roSave"); await p.waitForTimeout(300);
  ok(/Ramp\s*1/.test((await txt("#dPane")).replace(/\s+/g, " ")) && /your fix/.test(await txt("#dPane")), "fix a card's roles: Goblin Warchief now counts as ramp");
  // EDHREC blocked → fallback, no made-up numbers
  await p.evaluate(() => { EDH.mem.clear(); }); await p.evaluate(async () => { for (const k of ["commanders/krenko-mob-boss", "tags/goblins", "commanders/krenko-mob-boss/goblins"]) await idbSet("edh:" + k, null); });
  M.edhDown = true; await p.evaluate(() => { const id = Object.keys(S.decks)[0]; recState[id] = null; deckTab[id] = "suggest"; renderDeck(S.decks[id]); }); await p.waitForTimeout(1500);
  list = await txt("#rList"); const fb = await p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
  ok(/couldn't be loaded in this browser/.test(list) && /overall popularity/.test(list) && !/In \d+% of/.test(list) && fb.includes("Sol Ring") && !fb.includes("Swords to Plowshares"), "EDHREC blocked: Scryfall popularity list, clearly labelled, no made-up stats: " + fb.join(", "));
  await b.close(); srv.kill();
})();
