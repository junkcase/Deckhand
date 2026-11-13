// Search → Top 50: browse the 50 cards most played with a commander, in a theme, or both (EDHREC's statistics, in
// Deckhand's order), see which you own and which are missing, and add owned ones to a deck.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (name, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: "" }, o);
const nn = i => "Card " + String(i).padStart(2, "0");
const SPECIAL = { [nn(4)]: { colors: ["U"], color_identity: ["U"], mana_cost: "{U}" }, [nn(6)]: { legalities: { commander: "banned", modern: "legal" } }, [nn(8)]: { type_line: "Basic Land — Mountain", colors: [], color_identity: ["R"], mana_cost: "", cmc: 0 } };
const CARDS = [C("Krenko, Mob Boss", { type_line: "Legendary Creature — Goblin Warrior", cmc: 4 }), C("Krenko, Tin Street Kingpin", { type_line: "Legendary Creature — Goblin", cmc: 3 }), C("Ezuri, Renegade Leader", { type_line: "Legendary Creature — Elf Druid", colors: ["G"], color_identity: ["G"], mana_cost: "{1}{G}{G}", cmc: 3 }),
  ...Array.from({ length: 60 }, (_, i) => C(nn(i + 1), SPECIAL[nn(i + 1)] || {})), ...Array.from({ length: 12 }, (_, i) => C("Combo " + (i + 1))), ...Array.from({ length: 55 }, (_, i) => C("Gob " + String(i + 1).padStart(2, "0")))];
const view = (n, num, pot, syn) => Object.assign({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: pot }, syn === null ? {} : { synergy: syn });
// Krenko's page: 60 cards. Synergy falls from Card 01; Card 10 has no synergy figure (but the most decks); Cards 20 and 21 tie on synergy.
const KRENKO = Array.from({ length: 60 }, (_, i) => { const k = i + 1; return view(nn(k), k === 10 ? 49000 : ((k * 37) % 60) * 100 + 100, 50000, k === 10 ? null : k === 21 ? 0.9 - 20 * 0.01 : 0.9 - k * 0.01); });
const page = (lists, tags) => ({ container: { json_dict: { cardlists: lists } }, panels: { taglinks: tags || [] } });
const EDH = {
  "commanders/krenko-mob-boss": page([{ header: "High Synergy Cards", tag: "highsynergycards", cardviews: KRENKO.slice(0, 30) }, { header: "Instants", tag: "instants", cardviews: KRENKO.slice(30) }], [{ value: "Goblins", slug: "goblins", count: 4118 }, { value: "Tokens", slug: "tokens", count: 2000 }, { value: "Typal Madness", slug: "weird-slug-9", count: 7 }]),
  "tags/goblins": page([{ header: "Top Commanders", tag: "topcommanders", cardviews: [view("Krenko, Mob Boss", 4118, 9839, null)] }, { header: "Creatures", tag: "creatures", cardviews: Array.from({ length: 55 }, (_, i) => view("Gob " + String(i + 1).padStart(2, "0"), 5000 - i * 10, 9839, 0.8 - i * 0.01)) }]),
  "commanders/krenko-mob-boss/goblins": page([{ header: "Top Cards", tag: "topcards", cardviews: Array.from({ length: 12 }, (_, i) => view("Combo " + (i + 1), 900 - i, 1000, 0.5 - i * 0.01)) }]),
  "commanders/krenko-mob-boss/weird-slug-9": page([{ header: "Top Cards", tag: "topcards", cardviews: [view("Combo 1", 5, 7, 0.4)] }]),
  "tags/empty-theme": page([]),
  "commanders/krenko-tin-street-kingpin": page([{ header: "Top Cards", tag: "topcards", cardviews: [view("Card 01", 10, 20, 0.3)] }]),
};
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], M = { edhDown: false, sfDown: false, edh: [], sf: 0 };
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => { const k = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); M.edh.push(k); if (M.edhDown) return r.abort("failed"); return EDH[k] ? r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(EDH[k]) }) : r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { M.sf++; if (M.sfDown) return J({ object: "error", details: "down" }, 500); const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => CARDS.find(c => c.name === i.name || c.id === i.id)).filter(Boolean), not_found: [] }); }
    if (u.includes("/cards/search")) { const m = /is:commander name:"([^"]+)"/.exec(u); const hit = m ? CARDS.filter(c => /Legendary/.test(c.type_line) && c.name.toLowerCase().includes(m[1].toLowerCase())) : []; return hit.length ? J({ data: hit }) : J({ object: "error", code: "not_found", status: 404 }, 404); }
    return J({ data: [] }, 404); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8901/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(CARDS => {
    const by = Object.fromEntries(CARDS.map(c => [c.name, c])); S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    addToColl(slim(by["Card 01"]), "nonfoil", 1, "main", true); addToColl(slim(Object.assign({}, by["Card 01"], { id: "card-01-alt", set: "ltc" })), "foil", 2, "main", true);       // two printings: 3 copies
    for (const n of ["Card 03", "Card 04", "Card 06", "Card 08", "Card 20", "Gob 02", "Combo 3"]) addToColl(slim(by[n]), "nonfoil", 1, "main", true);
    addToColl(slim(by["Card 05"]), "nonfoil", 4, "wish", true);                                // only on the wishlist
    addToColl(slim(by["Ezuri, Renegade Leader"]), "nonfoil", 1, "main", true);                 // a legendary creature you own
    const deck = (id, name, format, cmdr, t) => { const d = { id, name, format, cmdr: [], cards: {}, created: 1, updated: t }; S.decks[id] = d; if (cmdr) { addToDeck(d, by[cmdr], 1, false, true); d.cmdr = [Object.keys(d.cards)[0]]; } return d; };
    const k = deck("k", "Goblins!", "commander", "Krenko, Mob Boss", 3); addToDeck(k, by["Card 03"], 1, false, true);
    deck("e", "Elves", "commander", "Ezuri, Renegade Leader", 2); const m = deck("m", "Modern pile", "modern", null, 1); addToDeck(m, by["Card 20"], 2, false, true);
    save(); go("search");
  }, CARDS);
  await p.waitForSelector("#sMode"); const before = await p.evaluate(() => JSON.stringify([S.coll, S.decks, S.binders, S.settings || null, S.meta.staples || null]));
  const names = () => p.$$eval("#tRows .item", a => a.map(x => x.dataset.name)), txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
  const want = list => list.slice().sort((a, b) => (b.synergy ?? -2) - (a.synergy ?? -2) || b.num_decks - a.num_decks || a.name.localeCompare(b.name)).map(c => c.name);

  // the mode switch: six modes, all still there, usable at this width
  const modes = await p.$$eval("#sMode button", a => a.map(x => x.textContent.trim().replace(/\s*·.*$/, "")));
  ok(modes.join("|") === "Search cards|Sets|Sealed|Staples|Top 50|Orders", `${label}: Top 50 sits among the Search modes, and every existing mode is still there (${modes.join(", ")})`);
  await p.click('#sMode [data-m="top50"]'); await p.waitForSelector("#tKind");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && await p.$eval('#sMode [data-m="top50"]', e => e.getAttribute("aria-pressed") === "true" && e.getBoundingClientRect().width > 30), `${label}: the mode switch fits the screen and Top 50 is selected`);
  ok(await p.$$eval("#sMode button", a => { const m = document.querySelector("#sMode").getBoundingClientRect(), on = a.find(x => x.getAttribute("aria-pressed") === "true").getBoundingClientRect(); return on.left >= m.left - 1 && on.right <= m.right + 1; }), `${label}: the chosen mode is fully in view in the switch`);
  await p.click('#sMode [data-m="lists"]'); await p.waitForTimeout(200);
  ok(await p.$eval('#sMode [data-m="lists"]', e => { const m = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return e.getAttribute("aria-pressed") === "true" && r.right <= m.right + 1 && r.left >= m.left - 1; }), `${label}: the last mode (Lists) can still be reached and is in view when chosen`);
  await p.click('#sMode [data-m="top50"]'); await p.waitForSelector("#tKind");
  ok(/Pick a commander/.test(await txt("#tList")) && M.edh.length === 0, `${label}: nothing is loaded until a commander or theme is picked`);

  // choosing a commander: from your decks, from the legendary creatures you own, by search
  if (process.env.SHOTS) await p.screenshot({ path: `/tmp/top50_pick_${label}.png` });
  ok((await p.$$eval("#tMine [data-cmd]", a => a.map(x => x.textContent))).join("|") === "Ezuri, Renegade Leader|Krenko, Mob Boss", `${label}: the commanders of your decks are offered`);
  ok((await p.$$eval("#tOwn option", a => a.map(x => x.textContent))).slice(1).join("|") === "Ezuri, Renegade Leader", `${label}: so are the legendary creatures in your collection`);
  await p.fill("#tQ", "krenko"); await p.click("#tFind button"); await p.waitForSelector("#tFound [data-cmd]");
  ok((await p.$$eval("#tFound [data-cmd]", a => a.map(x => x.textContent))).join("|") === "Krenko, Mob Boss|Krenko, Tin Street Kingpin", `${label}: a name search finds commanders (the app's existing Scryfall search)`);
  await p.fill("#tQ", "zzzz"); await p.click("#tFind button"); await p.waitForFunction(() => !/Searching/.test(document.querySelector("#tFound").textContent), null, { timeout: 15000 });
  ok(/No commanders found/.test(await txt("#tFound")), `${label}: a search with no result says so`);
  await p.click('#tMine [data-cmd="Krenko, Mob Boss"]'); await p.waitForSelector("#tRows");
  // commander page: 50 of 60, in the stated order
  let n = await names(); const exp = want(KRENKO);
  ok(n.length === 50 && n.join("|") === exp.slice(0, 50).join("|"), `${label}: a commander from one of your decks: exactly 50 of the page's 60 cards, highest synergy first, then most decks (${n.slice(0, 3).join(", ")}…)`);
  ok(n.indexOf("Card 21") === n.indexOf("Card 20") - 1 && !n.includes("Card 10") && exp.indexOf("Card 10") === 59, `${label}: a tie on synergy goes to the card in more decks; a card with no synergy figure comes after those that have one`);
  ok(n.includes("Card 08"), `${label}: a basic land in EDHREC's list is not left out`);
  ok(/Deckhand's ranking of EDHREC's statistics from 50,000 decks: highest synergy first, then most decks\. It is not an official EDHREC Top 50\./.test(await txt("#tSource")), `${label}: it says whose ranking this is`);
  ok(/^Top 50 of 60 cards for Krenko, Mob Boss: 6 owned · 44 missing$/.test(await txt("#tSum")), `${label}: the summary counts the list, the owned and the missing (${await txt("#tSum")})`);
  const row = name => p.$eval(`#tRows .item[data-name="${name}"]`, e => e.textContent.replace(/\s+/g, " ").trim());
  ok(/^1\. Card 01 .*Instant.*High Synergy Cards.*Owned ×3.*Synergy \+89% · in 8% of decks · 3,800 decks/.test(await row("Card 01")) && await p.$eval('#tRows .item[data-name="Card 01"] img', e => !!e.getAttribute("src")), `${label}: a row shows rank, name, picture, type, EDHREC's category, synergy, inclusion and decks; two printings you own count together (${(await row("Card 01")).slice(0, 110)})`);
  ok(/Missing/.test(await row("Card 05")) && !/Owned/.test(await row("Card 05")) && !(await p.$('#tRows .item[data-name="Card 05"] [data-tadd]')), `${label}: a card that is only on your wishlist is Missing, with no Add button`);
  ok(/Missing/.test(await row("Card 02")) && /Instant/.test(await row("Card 02")) && M.sf === 1, `${label}: missing cards get their details from one Scryfall lookup`);
  ok(await p.evaluate(b => JSON.stringify([S.coll, S.decks, S.binders, S.settings || null, S.meta.staples || null]) === b, before), `${label}: browsing changes nothing in the collection, decks, binders or settings`);
  // filters and sorting
  await p.click('#tShow [data-s="owned"]'); await p.waitForTimeout(100); ok((await names()).join("|") === "Card 01|Card 03|Card 04|Card 06|Card 08|Card 20", `${label}: Owned shows the 6 you own (${(await names()).join(", ")})`);
  await p.click('#tShow [data-s="missing"]'); await p.waitForTimeout(100); const miss = await names(); ok(miss.length === 44 && miss.includes("Card 05") && !miss.includes("Card 01") && /showing 44/.test(await txt("#tSum")), `${label}: Missing shows the other 44`);
  await p.click('#tShow [data-s="all"]'); await p.waitForTimeout(100); const best = await names();
  for (const [v, what, first] of [["syn", "highest synergy", "Card 01"], ["incl", "highest inclusion", null], ["pop", "most decks", null]]) {
    await p.selectOption("#tSort", v); await p.waitForTimeout(100); const m = await names();
    ok(m.length === 50 && m.slice().sort().join("|") === best.slice().sort().join("|") && (!first || m[0] === first), `${label}: sorted by ${what}: the same 50 cards in another order`);
  }
  const top50 = KRENKO.filter(c => best.includes(c.name)); const popWant = top50.slice().sort((a, b) => b.num_decks - a.num_decks)[0].name;
  ok((await names())[0] === popWant && popWant !== "Card 10", `${label}: most decks puts the most played of those 50 first (${popWant}), not a card from outside them`);
  await p.selectOption("#tSort", "best"); await p.waitForTimeout(100); ok((await names()).join("|") === best.join("|"), `${label}: best match restores the original order`);

  // adding owned cards to a chosen deck
  ok(await p.$$eval("[data-tadd]", a => a.length === 6 && a.every(x => x.disabled)), `${label}: owned cards have an Add button, off until a deck is chosen`);
  await p.selectOption("#tDeck", "k"); await p.waitForTimeout(150);
  const st = name => p.$eval(`#tRows .item[data-name="${name}"]`, e => ({ dis: e.querySelector("[data-tadd]").disabled, t: e.textContent.replace(/\s+/g, " "), tip: e.querySelector("[data-tadd]").title }));
  let a1 = await st("Card 01"), a3 = await st("Card 03"), a4 = await st("Card 04"), a6 = await st("Card 06");
  if (process.env.SHOTS) await p.screenshot({ path: `/tmp/top50_${label}.png` });
  ok(!a1.dis && /Add one copy to Goblins!/.test(a1.tip), `${label}: with a deck chosen, a card that fits can be added`);
  ok(a4.dis && /Outside this deck's colors/.test(a4.t), `${label}: a card outside that Commander deck's colors is flagged and can't be added`);
  ok(a6.dis && /Not legal in Commander/.test(a6.t), `${label}: a card banned in the deck's format is flagged and can't be added`);
  ok(a3.dis && /in deck ×1/.test(a3.t) && /Already in this deck/.test(a3.tip), `${label}: a card already in that Commander deck shows it and isn't added twice`);
  await p.click('#tRows .item[data-name="Card 01"] [data-tadd]'); await p.waitForTimeout(250);
  const after = await p.evaluate(() => ({ deck: Object.values(S.decks.k.cards).filter(c => c.name === "Card 01").map(c => [c.qty, c.side, c.id]), coll: Object.values(S.coll).filter(e => e.name === "Card 01").map(e => e.qty).join("+"), n: Object.keys(S.decks.k.cards).length }));
  ok(JSON.stringify(after.deck) === JSON.stringify([[1, false, "id-card-01"]]) && after.n === 3, `${label}: Add puts one copy in the deck's main deck, as one entry (${JSON.stringify(after.deck)})`);
  ok(after.coll === "1+2", `${label}: the collection's quantities are untouched (${after.coll})`);
  a1 = await st("Card 01"); ok(a1.dis && /in deck ×1/.test(a1.t) && /Owned ×3/.test(a1.t), `${label}: the row updates at once: in the deck, still owned ×3`);
  await p.selectOption("#tDeck", "m"); await p.waitForTimeout(150); a1 = await st("Card 01"); a6 = await st("Card 06");
  ok(!a1.dis && !a6.dis && !/Outside/.test((await st("Card 04")).t), `${label}: another deck has its own rules: no color limit in a deck without a commander, and what is legal there can be added`);
  await p.selectOption("#tDeck", "e"); await p.waitForTimeout(150); ok((await st("Card 01")).dis && /Outside this deck's colors/.test((await st("Card 01")).t), `${label}: for a green Commander deck the red cards are flagged`);

  // themes: the commander's own themes are offered, with the page's address for them
  const topts = await p.$$eval("#tTheme option", a => a.map(x => x.textContent));
  ok(topts[1] === "Goblins (4,118 decks)" && topts.includes("Typal Madness (7 decks)") && topts.includes("Voltron"), `${label}: the theme list has this commander's EDHREC themes and the app's own themes (${topts.slice(0, 5).join(" | ")})`);
  await p.selectOption("#tTheme", "Goblins"); await p.waitForSelector('#tRows .item[data-name="Combo 1"]'); n = await names();
  ok(n.length === 12 && n[0] === "Combo 1" && /^All 12 cards for Krenko, Mob Boss · Goblins: 1 owned · 11 missing \(EDHREC lists fewer than 50 here\)$/.test(await txt("#tSum")) && M.edh.includes("commanders/krenko-mob-boss/goblins"), `${label}: commander and theme together use EDHREC's combined page; with fewer than 50 cards it shows them all and says so (${await txt("#tSum")})`);
  await p.selectOption("#tTheme", "Typal Madness"); await p.waitForTimeout(500);
  ok(M.edh.includes("commanders/krenko-mob-boss/weird-slug-9") && (await names()).join() === "Combo 1", `${label}: a commander's theme is fetched by the address EDHREC gives for it`);
  await p.selectOption("#tTheme", "Tokens"); await p.waitForTimeout(600);
  ok(/EDHREC has no page for Krenko, Mob Boss with the theme “Tokens”, so this is Krenko, Mob Boss's own list\./.test(await txt("#tNote")) && (await names()).length === 50, `${label}: no combined page: it says so and shows the commander's own list`);
  // theme browsing
  await p.click('#tKind [data-k="theme"]'); await p.waitForSelector("#tTheme"); await p.selectOption("#tTheme", "Goblins"); await p.waitForSelector('#tRows .item[data-name="Gob 01"]'); n = await names();
  ok(n.length === 50 && n[0] === "Gob 01" && !n.includes("Krenko, Mob Boss") && /^Top 50 of 55 cards for Goblins: 1 owned · 49 missing$/.test(await txt("#tSum")), `${label}: a theme: its 50 strongest cards; the page's "top commanders" aren't listed as cards to play (${await txt("#tSum")})`);
  await p.fill("#tThemeIn", "Empty Theme"); await p.click("#tThemeForm button"); await p.waitForSelector("#tEmpty");
  ok(/lists no cards/.test(await txt("#tEmpty")) && /The page loaded, but it is empty/.test(await txt("#tEmpty")), `${label}: a typed theme whose page has no cards: a real empty result, said as such`);
  await p.fill("#tThemeIn", "Nonexistent Thing"); await p.click("#tThemeForm button"); await p.waitForSelector("#tErr");
  ok(/EDHREC has no page for this\./.test(await txt("#tErr")) && /missing page, not an empty list/.test(await txt("#tErr")), `${label}: a typed theme with no page: said to be a missing page, not an empty list`);

  // Scryfall lookup fails: names and statistics still shown
  M.sfDown = true; await p.evaluate(() => { CC.miss.clear(); }); await p.click('#tKind [data-k="commander"]'); await p.waitForSelector("#tChange"); await p.click("#tChange"); await p.fill("#tQ", "tin street"); M.sfDown = false; await p.click("#tFind button"); await p.waitForSelector('#tFound [data-cmd="Krenko, Tin Street Kingpin"]');
  await p.evaluate(async () => { const m = await cardCache(); m.clear(); }); M.sfDown = true;
  await p.evaluate(() => { for (const k of Object.keys(S.coll)) if (S.coll[k].name === "Card 01") delete S.coll[k]; staleIndex(); });
  await p.click('#tFound [data-cmd="Krenko, Tin Street Kingpin"]'); await p.waitForSelector("#tRows");
  ok(/couldn't be loaded just now; their names and statistics are shown/.test(await txt("#tLookup")) && /Details not loaded/.test(await row("Card 01")) && /Synergy \+30% · in 50% of decks · 10 decks/.test(await row("Card 01")) && /All 1 card for/.test(await txt("#tSum")), `${label}: when card details can't be looked up, the list still shows names and statistics, and says what is missing`);
  M.sfDown = false;

  // EDHREC unreachable: with a saved copy, and without one
  M.edhDown = true;
  await p.evaluate(async () => { EDH.mem.clear(); const k = "edh:commanders/krenko-mob-boss", v = await idbGet(k); v.at = Date.now() - 9 * 864e5; await idbSet(k, v); });
  await p.click("#tChange"); await p.click('#tMine [data-cmd="Krenko, Mob Boss"]'); await p.waitForSelector("#tRows");
  ok(/Showing statistics saved earlier; EDHREC couldn't be reached just now\./.test(await txt("#tNote")) && (await names()).length === 50, `${label}: EDHREC unreachable but a copy is saved: the saved list is shown, with a note`);
  await p.click("#tChange"); await p.click('#tMine [data-cmd="Ezuri, Renegade Leader"]'); await p.waitForSelector("#tErr");
  ok(/EDHREC's statistics couldn't be loaded\./.test(await txt("#tErr")) && /connection problem, not an empty list/.test(await txt("#tErr")) && !(await p.$("#tRows")), `${label}: EDHREC unreachable and nothing saved: it says so, shows no made-up list, and offers to try again`);
  M.edhDown = false; EDH["commanders/ezuri-renegade-leader"] = page([{ header: "Top Cards", tag: "topcards", cardviews: [view("Gob 02", 3, 9, 0.2)] }]);
  await p.click("#tRetry"); await p.waitForSelector("#tRows"); ok((await names()).join() === "Gob 02", `${label}: Try again loads it once EDHREC is back`);

  // the other Search modes and the deck Suggestions still work
  await p.click('#sMode [data-m="staples"]'); await p.waitForTimeout(400); ok(await p.evaluate(() => sv.mode === "staples" && document.querySelector("#viewTitle").textContent === "Staples"), `${label}: Staples still opens`);
  await p.click('#sMode [data-m="search"]'); await p.waitForSelector("#sq"); ok(!!(await p.$("#sq")), `${label}: Search cards still opens`);
  await p.click('#sMode [data-m="top50"]'); await p.waitForSelector("#tRows"); ok((await names()).join() === "Gob 02" && await txt("#tCmd") === "Ezuri, Renegade Leader", `${label}: coming back to Top 50, the last choice is still there (kept in memory only)`);
  ok(await p.evaluate(() => !("top50" in S) && !("t50" in S.meta) && !("t50" in (S.settings || {}))), `${label}: nothing about it is saved`);
  await p.evaluate(() => go("decks", "k")); await p.waitForSelector("#dTabs"); await p.click('#dTabs [data-t="suggest"]'); await p.waitForSelector("#rPool"); await p.waitForSelector("#rList .item");
  ok(await p.$$eval("#rList .item", a => a.length > 0) && !!(await p.$('#rPool [data-p="mine"]')), `${label}: the deck's Suggestions tab still lists cards`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: fits the screen`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8901", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
