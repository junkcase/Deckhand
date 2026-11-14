// Deck → Upgrade → Top 50 analyzer: the deck held against the 50 cards most played with its commander.
// EDHREC and Scryfall are pretend here (routes below); nothing in this file talks to the real services.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (name, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: "" }, o);
const nn = i => "Card " + String(i).padStart(2, "0");
const SPECIAL = { [nn(4)]: { colors: ["U"], color_identity: ["U"], mana_cost: "{U}" }, [nn(6)]: { legalities: { commander: "banned", modern: "legal" } } };
const CARDS = [C("Krenko, Mob Boss", { type_line: "Legendary Creature — Goblin Warrior", cmc: 4 }), C("Krenko, Tin Street Kingpin", { type_line: "Legendary Creature — Goblin", cmc: 3 }), C("Ezuri, Renegade Leader", { type_line: "Legendary Creature — Elf Druid", colors: ["G"], color_identity: ["G"], mana_cost: "{1}{G}{G}", cmc: 3 }),
  C("Neheb, the Eternal", { type_line: "Legendary Creature — Zombie Minotaur", cmc: 5 }), C("Purphoros, God of the Forge", { type_line: "Legendary Enchantment Creature — God", cmc: 4 }), C("Zada, Hedron Grinder", { type_line: "Legendary Creature — Goblin Ally", cmc: 4 }), C("Squee, Goblin Nabob", { type_line: "Legendary Creature — Goblin", cmc: 3 }),
  ...Array.from({ length: 24 }, (_, i) => C("Land " + String(i + 1).padStart(2, "0"), { type_line: "Land", colors: [], color_identity: i === 6 ? ["U"] : [], mana_cost: "", cmc: 0 })), C("Stray Land", { type_line: "Land", colors: [], color_identity: [], mana_cost: "", cmc: 0 }),
  ...Array.from({ length: 55 }, (_, i) => C("Sq " + String(i + 1).padStart(2, "0"))),
  C("Stray A"), C("Stray B"), C("Mountain", { type_line: "Basic Land — Mountain", colors: [], mana_cost: "", cmc: 0 }), C("Elf Thing", { colors: ["G"], color_identity: ["G"], mana_cost: "{G}" }),
  ...Array.from({ length: 60 }, (_, i) => C(nn(i + 1), SPECIAL[nn(i + 1)] || {}))];
const view = (n, num, pot, syn) => Object.assign({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: pot }, syn === null ? {} : { synergy: syn });
// Krenko's page: 60 cards, synergy falling from Card 01; Card 10 has no synergy figure, so it is last and outside the Top 50
const KRENKO = Array.from({ length: 60 }, (_, i) => { const k = i + 1; return view(nn(k), k === 10 ? 49000 : ((k * 37) % 60) * 100 + 100, 50000, k === 10 ? null : 0.9 - k * 0.01); });
const page = lists => ({ container: { json_dict: { cardlists: lists } }, panels: { taglinks: [] } });
const EDH = {
  "commanders/krenko-mob-boss": page([{ header: "High Synergy Cards", tag: "highsynergycards", cardviews: KRENKO }]),
  "commanders/krenko-tin-street-kingpin": page([{ header: "Top Cards", tag: "topcards", cardviews: [view("Card 01", 10, 20, 0.3), view("Card 03", 8, 20, 0.2)] }]),      // fewer than 50; this deck holds both
  "commanders/ezuri-renegade-leader": page([{ header: "Top Cards", tag: "topcards", cardviews: [view("Elf Thing", 9, 10, 0.5), view("Card 30", 5, 10, 0.1)] }]),          // none owned
  // Squee's page: 55 spells and 24 lands (low synergy; Land 03 in the most decks)
  "commanders/squee-goblin-nabob": page([{ header: "Instants", tag: "instants", cardviews: Array.from({ length: 55 }, (_, i) => view("Sq " + String(i + 1).padStart(2, "0"), 3000 - i * 10, 9000, 0.8 - i * 0.01)) },
    { header: "Lands", tag: "lands", cardviews: Array.from({ length: 24 }, (_, i) => view("Land " + String(i + 1).padStart(2, "0"), i === 2 ? 8900 : 8000 - i * 100, 9000, 0.02)) }]),
  "commanders/neheb-the-eternal": page([]),                                                                                                                       // a page with no cards
  "commanders/purphoros-god-of-the-forge": { something: "else entirely" },                                                                                       // not the shape expected
  "commanders/zada-hedron-grinder": "<<<not json>>>",                                                                                                             // not JSON at all
};
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], failed = [], M = { edhDown: false, edh: [] };
  p.on("pageerror", e => errs.push(e.message)); p.on("requestfailed", r => { if (/scryfall|edhrec/.test(r.url()) && !(M.edhDown && /edhrec/.test(r.url()))) failed.push(r.url()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => { const k = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); M.edh.push(k); if (M.edhDown) return r.abort("failed"); const v = EDH[k];
    return v === undefined ? r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }) : r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: typeof v === "string" ? v : JSON.stringify(v) }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => CARDS.find(c => c.name === i.name || c.id === i.id)).filter(Boolean), not_found: [] }); }
    return J({ data: [] }, u.includes("/cards/search") ? 200 : 404); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8903/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(CARDS => {
    const by = Object.fromEntries(CARDS.map(c => [c.name, c])); S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    addToColl(slim(by["Card 01"]), "nonfoil", 1, "main", true); addToColl(slim(Object.assign({}, by["Card 01"], { id: "card-01-alt", set: "ltc" })), "foil", 2, "main", true);      // two printings: 3 copies
    for (const n of ["Card 02", "Card 03", "Card 04", "Card 06", "Card 09"]) addToColl(slim(by[n]), "nonfoil", 1, "main", true);
    const noLeg = slim(by["Card 12"]); delete noLeg.leg; addToColl(noLeg, "nonfoil", 1, "main", true);                              // owned, with no legality on record
    addToColl(slim(by["Card 05"]), "nonfoil", 4, "wish", true);                                                                      // only on the wishlist
    const deck = (id, name, format, cmdr, t) => { const d = { id, name, format, cmdr: [], cards: {}, created: 1, updated: t }; S.decks[id] = d; if (cmdr) { addToDeck(d, by[cmdr], 1, false, true); d.cmdr = [Object.keys(d.cards)[0]]; } return d; };
    const k = deck("k", "Goblins!", "commander", "Krenko, Mob Boss", 9);
    addToDeck(k, by["Card 03"], 1, false, true);                                           // in the main deck
    addToDeck(k, by["Card 07"], 1, true, true);                                            // in the sideboard
    addToDeck(k, by["Card 09"], 2, false, true); addToDeck(k, by["Card 09"], 1, true, true);      // several copies, main and side
    addToDeck(k, by["Card 11"], 1, false, true); addToDeck(k, Object.assign({}, by["Card 11"], { id: "card-11-alt", set: "ltc" }), 1, false, true);      // two printings of one card
    addToDeck(k, by["Card 55"], 1, false, true);                                           // on EDHREC's page, but not in its Top 50
    addToDeck(k, by["Stray A"], 1, false, true); addToDeck(k, by["Stray B"], 1, true, true); addToDeck(k, by["Mountain"], 20, false, true);
    const o = deck("o", "Other deck", "commander", "Squee, Goblin Nabob", 8); addToDeck(o, by["Card 02"], 1, false, true);      // uses your only Card 02
    addToDeck(o, by["Land 04"], 1, false, true); addToDeck(o, by["Stray Land"], 1, false, true); addToDeck(o, by["Mountain"], 30, false, true); addToDeck(o, by["Sq 02"], 1, false, true);
    addToColl(slim(by["Land 05"]), "nonfoil", 2, "main", true); addToColl(slim(by["Land 07"]), "nonfoil", 1, "main", true); addToColl(slim(by["Sq 01"]), "nonfoil", 1, "main", true);
    const t = deck("t", "Tin Street", "commander", "Krenko, Tin Street Kingpin", 7); addToDeck(t, by["Card 01"], 1, false, true); addToDeck(t, by["Card 03"], 1, false, true);
    deck("e", "Elves", "commander", "Ezuri, Renegade Leader", 6); deck("n", "Neheb", "commander", "Neheb, the Eternal", 5); deck("pu", "Purphoros", "commander", "Purphoros, God of the Forge", 4); deck("z", "Zada", "commander", "Zada, Hedron Grinder", 3);
    deck("x", "No commander yet", "commander", null, 2); const m = deck("m", "Modern pile", "modern", null, 1); addToDeck(m, by["Card 20"], 2, false, true);
    const two = deck("two", "Two leaders", "commander", "Krenko, Mob Boss", 0); addToDeck(two, by["Squee, Goblin Nabob"], 1, false, true); two.cmdr = Object.keys(two.cards);
    save();
  }, CARDS);
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
  const openAn = async id => { await p.evaluate(id => { deckTab[id] = "upgrade"; upgMode[id] = "analyze"; go("decks", id); }, id); await p.waitForSelector("#uMode"); };
  const grp = g => p.$$eval(`#an-${g} .item`, a => a.map(x => x.dataset.name));
  const rowT = (g, name) => p.$eval(`#an-${g} .item[data-name="${name}"]`, e => e.textContent.replace(/\s+/g, " ").trim());
  const openAll = () => p.$$eval("#an details", a => a.forEach(d => { d.open = true; }));
  const sum = () => p.$$eval("#anSum > div", a => a.map(x => x.querySelector(".label").textContent.trim() + " " + x.querySelector("b").textContent.trim()).join(" | "));
  const snapColl = () => p.evaluate(() => JSON.stringify(S.coll));

  // ---- the view sits in the Upgrade tab, beside the existing swap suggestions, which stay the default
  await p.evaluate(() => { deckTab.k = "upgrade"; go("decks", "k"); }); await p.waitForSelector("#uMode");
  ok(await p.$eval('#uMode [data-u="swaps"]', e => e.getAttribute("aria-pressed") === "true") && !(await p.$("#an")), `${label}: the Upgrade tab still opens on its swap suggestions; the analyzer is a second view`);
  await p.waitForTimeout(900); const coll0 = await snapColl(), keys0 = await p.evaluate(() => Object.keys(S.decks.k).sort().join());
  await p.click('#uMode [data-u="analyze"]'); await p.waitForSelector("#anSum");
  // ---- all four groups, and the summary
  ok(await txt("#anCmd") === "Krenko, Mob Boss" && /^In your deck 4\/50 \| Owned, not in it 3 \| Not owned 41 \| Deck cards outside it 3$/.test(await sum()), `${label}: the summary names the commander and counts the four groups (${await sum()})`);
  ok(/The Top 50 of 60 cards on EDHREC's page.*Deckhand's ranking of EDHREC's statistics from 50,000 decks \(highest synergy first, then most decks\).*not an official EDHREC list\./.test(await txt("#anSource")), `${label}: it says whose ranking this is`);
  ok(await txt("#anAdds") === "4 in the deck + 3 owned + 41 not owned + 2 that can't go in this deck = 50 cards in the list.", `${label}: the counts are shown adding up to the list (${await txt("#anAdds")})`);
  // every card of the list is in exactly one group, and the summary shows the groups' own counts
  const recon = async id => p.evaluate(id => { const d = S.decks[id], R = anState[id].data, A = analyzeTop50(d, R), names = g => A[g].map(r => r.name), all = [...names("have"), ...names("owned"), ...names("missing"), ...names("blocked")];
    const tiles = [...document.querySelectorAll("#anSum b")].map(b => parseInt(b.textContent, 10)), heads = Object.fromEntries([...document.querySelectorAll("#an details[data-g]")].map(x => [x.dataset.g, +x.querySelector("summary b").textContent]));
    return { once: new Set(all).size === all.length, sum: all.length === R.rows.length && all.slice().sort().join() === R.rows.map(r => r.name).sort().join(), ownedOk: A.owned.every(r => r.own > 0 && !r.why && !r.main && !r.side), missOk: A.missing.every(r => r.own === 0 && !r.why), blockOk: A.blocked.every(r => !!r.why),
      haveOk: A.have.every(r => r.main + r.side > 0), tiles: tiles.join(), want: [A.have.length, A.owned.length, A.missing.length, A.outside.length].join(), heads: heads.have === A.have.length && heads.owned === A.owned.length && heads.missing === A.missing.length && (heads.blocked || 0) === A.blocked.length && heads.outside === A.outside.length,
      outOk: A.outside.concat(A.basics).every(r => !R.rows.some(x => x.name === r.name)) }; }, id);
  let rc = await recon("k");
  ok(rc.once && rc.sum, `${label}: every card of the list is in exactly one group, and the groups together are the whole list`);
  ok(rc.ownedOk && rc.missOk && rc.blockOk && rc.haveOk && rc.outOk, `${label}: no card is both an owned upgrade and a missing one; cards that can't go in the deck are in neither; "outside" holds no card of the list`);
  ok(rc.tiles === rc.want && rc.heads, `${label}: the summary's numbers are the groups' own counts (${rc.tiles})`);
  ok(await p.$eval("#an-owned", e => e.open) && await p.$$eval("#an details:not(#an-owned)", a => a.every(d => !d.open)), `${label}: the groups fold; owned upgrades is the one open to begin with`);
  await openAll();
  ok((await grp("have")).join("|") === "Card 03|Card 07|Card 09|Card 11", `${label}: Already in your deck: the Top 50 cards the deck holds (${(await grp("have")).join(", ")})`);
  ok(/^#3 Card 03 .*1 in the main deck/.test(await rowT("have", "Card 03")) && /^#7 Card 07 .*1 in the sideboard/.test(await rowT("have", "Card 07")), `${label}: with its position, and whether it is in the main deck or the sideboard`);
  ok(/2 in the main deck, 1 in the sideboard/.test(await rowT("have", "Card 09")), `${label}: several copies are counted, main deck and sideboard apart`);
  ok(/2 in the main deck/.test(await rowT("have", "Card 11")) && (await grp("have")).filter(x => x === "Card 11").length === 1, `${label}: two printings of one card are one row with both copies`);
  ok((await grp("owned")).join("|") === "Card 01|Card 02|Card 12", `${label}: Owned upgrades: Top 50 cards you own that aren't in the deck (${(await grp("owned")).join(", ")})`);
  ok(/^#1 Card 01 .*Owned ×3.*Synergy \+89% · in 8% of decks · 3,800 decks/.test(await rowT("owned", "Card 01")), `${label}: with position, copies owned (two printings together) and EDHREC's figures`);
  ok(/Owned ×1.*1 in other decks/.test(await rowT("owned", "Card 02")) && !/free/.test(await rowT("owned", "Card 02")), `${label}: copies another deck uses are shown; with sharing on, no "free" count is needed`);
  ok((await grp("blocked")).join("|") === "Card 04|Card 06" && await p.$$eval("#an-blocked [data-anadd]", a => a.length === 0), `${label}: cards that can't go in this deck are in a group of their own, with no Add button (${(await grp("blocked")).join(", ")})`);
  ok(/Owned ×1.*Outside this deck's colors/.test(await rowT("blocked", "Card 04")), `${label}: an off-color card you own is flagged there, not offered as an upgrade`);
  ok(/Owned ×1.*Not legal in Commander/.test(await rowT("blocked", "Card 06")), `${label}: a banned card you own is flagged there too`);
  ok(/Legality not known/.test(await rowT("owned", "Card 12")) && await p.$eval('#an-owned .item[data-name="Card 12"] [data-anadd]', e => !e.disabled), `${label}: a card with no legality on record says so, and can be added as elsewhere in the app`);
  const miss = await grp("missing");
  ok(miss.length === 41 && miss.includes("Card 05") && /Not owned/.test(await rowT("missing", "Card 05")) && await p.$$eval("#an-missing [data-anadd]", a => a.length === 0), `${label}: Missing upgrades: the 41 you don't own (a wishlist-only card among them), marked Not owned, with no Add button`);
  ok(/^#5 Card 05 .*Synergy \+85%/.test(await rowT("missing", "Card 05")), `${label}: a missing card shows its position and EDHREC's figures`);
  ok((await grp("outside")).join("|") === "Card 55|Stray A|Stray B", `${label}: Outside the Top 50: the deck's other cards, the commander itself left out (${(await grp("outside")).join(", ")})`);
  ok(/1 in the main deck/.test(await rowT("outside", "Stray A")) && /1 in the sideboard/.test(await rowT("outside", "Stray B")) && !/#\d/.test(await rowT("outside", "Card 55")), `${label}: with how many and where; a card on EDHREC's page but below its 50th place counts as outside`);
  const outT = await txt("#an-outside");
  ok(/The deck's 20 basic lands \(Mountain ×20\) are not listed here\./.test(outT) && !(await grp("outside")).includes("Mountain"), `${label}: basic lands are mentioned in one line, not listed among the cards`);
  ok(/That is all this means: the list counts how often cards are played with Krenko, Mob Boss, not how good they are, and it is not a list of cards to take out\./.test(outT) && !/\b(cut|remove|weak|bad|replace)\b/i.test(outT), `${label}: the outside group says plainly it is no judgement and no list of cuts`);
  ok(await p.$$eval("#an [data-anadd]", a => a.length) > 0 && !(await p.evaluate(() => /\b(cut|remove)\b/i.test(document.querySelector("#an").textContent))), `${label}: nothing in the analyzer suggests removing a card`);

  if (process.env.SHOTS) { await p.$$eval("#an details", a => a.forEach((d, i) => { d.open = d.id === "an-owned"; })); await p.evaluate(() => document.querySelector("#uMode").scrollIntoView()); await p.screenshot({ path: `/tmp/an_${label}.png` }); await openAll(); }
  // ---- strongest cards not in the deck: order, and that sorting never changes the list or its positions
  const strong = () => p.$$eval("#anStrong .item", a => a.map(x => x.querySelector(".name").textContent.replace(/\s+/g, " ").trim()));
  ok((await strong()).join("|") === "#1 Card 01|#2 Card 02|#5 Card 05|#8 Card 08|#11 Card 12", `${label}: strongest cards not in the deck: by position, skipping what is in the deck and what can't go in it (${(await strong()).join(", ")})`);
  const posBefore = await p.$$eval("#an-owned .item .name, #an-missing .item .name, #an-have .item .name", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()).join("|"));
  await p.selectOption("#anSort", "owned"); await p.waitForTimeout(120);
  ok((await strong()).join("|") === "#1 Card 01|#2 Card 02|#11 Card 12|#5 Card 05|#8 Card 08", `${label}: "cards you own first" puts owned ones first, each keeping its position number (${(await strong()).join(", ")})`);
  await p.selectOption("#anSort", "pop"); await p.waitForTimeout(120); const popS = await strong();
  const cand = KRENKO.filter(c => !["Card 03", "Card 07", "Card 09", "Card 11", "Card 04", "Card 06", "Card 10"].includes(c.name)).filter(c => +c.name.slice(5) <= 51).sort((a, b) => b.num_decks - a.num_decks).slice(0, 5).map(c => c.name);
  ok(popS.map(x => x.replace(/^#\d+ /, "")).join("|") === cand.join("|"), `${label}: "most decks" orders by EDHREC's deck counts (${popS.join(", ")})`);
  await p.selectOption("#anSort", "syn"); await p.waitForTimeout(120);
  ok((await strong()).join("|") === "#1 Card 01|#2 Card 02|#5 Card 05|#8 Card 08|#11 Card 12", `${label}: "highest synergy" orders by synergy`);
  await openAll();
  ok(await p.$$eval("#an-owned .item .name, #an-missing .item .name, #an-have .item .name", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()).join("|")) === posBefore, `${label}: changing the order changes neither which cards are in the Top 50 nor their positions`);
  await p.selectOption("#anSort", "best"); await p.waitForTimeout(120);

  // ---- sharing copies off: what other decks use is not free
  await p.evaluate(() => { S.settings = S.settings || {}; S.settings.shareCopies = false; save(); renderDeck(S.decks.k); }); await p.waitForSelector("#anSum"); await openAll();
  ok(/Owned ×1.*1 in other decks.*0 free/.test(await rowT("owned", "Card 02")) && /Owned ×3.*1 in other decks.*2 free/.test(await rowT("owned", "Card 01")) && /Sharing copies between decks is off/.test(await txt("#an-owned")), `${label}: with sharing copies off, each owned card shows how many are free (${(await rowT("owned", "Card 02")).slice(0, 70)})`);
  await p.evaluate(() => { S.settings.shareCopies = true; save(); renderDeck(S.decks.k); }); await p.waitForSelector("#anSum");

  // ---- adding an owned upgrade
  const before = await p.evaluate(() => ({ main: deckStats(S.decks.k).mainN, side: deckStats(S.decks.k).sideN }));
  await p.click('#an-owned .item[data-name="Card 01"] [data-anadd]'); await p.waitForTimeout(350); await openAll();
  ok((await grp("have")).includes("Card 01") && !(await grp("owned")).includes("Card 01") && /1 in the main deck/.test(await rowT("have", "Card 01")), `${label}: ＋ adds one copy to the main deck and the card moves to "Already in your deck" at once`);
  ok(/^In your deck 5\/50 \| Owned, not in it 2 \| Not owned 41 \| Deck cards outside it 3$/.test(await sum()), `${label}: the counts update (${await sum()})`);
  ok(await snapColl() === coll0, `${label}: the collection's quantities are untouched`);
  rc = await recon("k"); ok(rc.once && rc.sum && rc.tiles === rc.want && rc.heads && await txt("#anAdds") === "5 in the deck + 2 owned + 41 not owned + 2 that can't go in this deck = 50 cards in the list.", `${label}: after adding, the groups still add up to the list (${await txt("#anAdds")})`);
  const after = await p.evaluate(() => ({ main: deckStats(S.decks.k).mainN, side: deckStats(S.decks.k).sideN, entries: Object.values(S.decks.k.cards).filter(c => c.name === "Card 01").map(c => [c.qty, c.side]) }));
  ok(after.main === before.main + 1 && after.side === before.side && JSON.stringify(after.entries) === "[[1,false]]", `${label}: the deck's main count goes up by one, the sideboard is unchanged, one entry (${before.main}→${after.main})`);
  ok((await strong())[0] === "#2 Card 02", `${label}: the strongest-additions list moves on to the next card`);
  ok(await p.evaluate(k => Object.keys(S.decks.k).sort().join() === k && !("analyzer" in S.meta) && !("upgMode" in S.meta), keys0), `${label}: the analyzer saves nothing of its own in the deck or the settings`);
  // refresh reruns it
  const n0 = M.edh.filter(x => x === "commanders/krenko-mob-boss").length; await p.click("#anRefresh"); await p.waitForTimeout(700); await p.waitForSelector("#anSum");
  ok(M.edh.filter(x => x === "commanders/krenko-mob-boss").length === n0 + 1 && /^In your deck 5\/50/.test(await sum()), `${label}: Refresh fetches EDHREC's page again and reruns the comparison`);

  // ---- lands: a group of their own, each land in exactly one place
  await openAn("o"); await p.waitForSelector("#anSum"); await openAll();
  ok(/^In your deck 1\/50 \| Owned, not in it 1 \| Not owned 48 \| Deck cards outside it 2$/.test(await sum()) && await txt("#anAdds") === "1 in the deck + 1 owned + 48 not owned = 50 cards in the list.", `${label}: a commander whose lands all fall outside the 50: the Top 50 counts hold no lands (${await sum()})`);
  const lg = await grp("lands");
  ok(lg.length === 20 && lg.slice(0, 3).join("|") === "Land 03|Land 01|Land 02" && !lg.includes("Land 24"), `${label}: "Most-played lands" lists the 20 lands in the most decks (${lg.slice(0, 3).join(", ")}…)`);
  ok(await txt("#anLandAdds") === "1 in the deck + 1 owned + 17 not owned + 1 that can't go in this deck = 20 lands.", `${label}: the lands add up on their own line (${await txt("#anLandAdds")})`);
  ok(/^Land #4 Land 04 .*1 in the main deck/.test(await rowT("lands", "Land 04")) && /^Land #5 Land 05 .*Owned ×2/.test(await rowT("lands", "Land 05")) && /Not owned/.test(await rowT("lands", "Land 01")) && /Owned ×1.*Outside this deck's colors/.test(await rowT("lands", "Land 07")), `${label}: each land shows where it stands: in the deck, owned, not owned, or unable to go in (${(await rowT("lands", "Land 04")).slice(0, 60)})`);
  ok(await p.$$eval("#an-lands [data-anadd]", a => a.length) === 1 && !!(await p.$('#an-lands .item[data-name="Land 05"] [data-anadd]')), `${label}: only the owned land that fits has an Add button`);
  const landRc = await p.evaluate(() => { const A = analyzeTop50(S.decks.o, anState.o.data), names = A.lands.map(r => r.name), top = [...A.have, ...A.owned, ...A.missing, ...A.blocked].map(r => r.name);
    return { once: new Set(names).size === names.length, apart: !names.some(n => top.includes(n)), outside: !A.outside.concat(A.basics).some(r => names.includes(r.name) || top.includes(r.name)), places: A.lands.every(r => ["have", "owned", "missing", "blocked"].includes(r.at)) }; });
  ok(landRc.once && landRc.apart && landRc.outside && landRc.places, `${label}: no land is counted twice, none is also in the Top 50 groups, and none is also listed as "outside"`);
  ok((await grp("outside")).join("|") === "Card 02|Stray Land" && /or the most-played lands above/.test(await txt("#an-outside")) && /The deck's 30 basic lands \(Mountain ×30\) are not listed here\./.test(await txt("#an-outside")), `${label}: a land in the deck that isn't among the most-played lands is "outside"; one that is isn't; basics are one line (${(await grp("outside")).join(", ")})`);
  await p.click('#an-lands .item[data-name="Land 05"] [data-anadd]'); await p.waitForTimeout(350); await openAll();
  ok(await txt("#anLandAdds") === "2 in the deck + 0 owned + 17 not owned + 1 that can't go in this deck = 20 lands." && /1 in the main deck/.test(await rowT("lands", "Land 05")) && await p.evaluate(() => Object.values(S.coll).find(e => e.name === "Land 05").qty === 2), `${label}: adding an owned land moves it to "in the deck" and leaves the collection alone (${await txt("#anLandAdds")})`);
  await openAn("k"); await p.waitForSelector("#anSum");
  ok(!(await p.$("#an-lands")), `${label}: a commander page with no land category gets no lands group`);
  // ---- decks it can't analyze, and short or empty lists
  await openAn("x"); await p.waitForSelector("#anNeed");
  ok(/This needs a commander\./.test(await txt("#anNeed")) && /Choose this deck's commander/.test(await txt("#anNeed")) && !M.edh.some(x => /undefined|null/.test(x)), `${label}: a Commander deck with no commander: it says one is needed and loads nothing`);
  await openAn("m"); await p.waitForSelector("#anNeed");
  ok(/isn't a Commander deck/.test(await txt("#anNeed")), `${label}: a deck in another format: it says there is no commander to compare with`);
  await openAn("t"); await p.waitForSelector("#anSum"); await openAll();
  ok(/^In your deck 2\/2 \| Owned, not in it 0 \| Not owned 0 \| Deck cards outside it 0$/.test(await sum()) && /EDHREC lists 2 cards for this commander, fewer than 50; all of them are used\./.test(await txt("#anSource")), `${label}: a commander with fewer than 50 cards listed: all are used, and it says so (${await sum()})`);
  ok(/Nothing to add: they are all in the deck\./.test(await txt("#an-owned")) && /You own every card in the 2 cards EDHREC lists\./.test(await txt("#an-missing")) && /Every card in the 2 cards EDHREC lists is already in this deck\./.test(await txt("#anStrong")), `${label}: no owned upgrades and no missing cards: each group says so`);
  rc = await recon("t"); ok(rc.once && rc.sum && rc.tiles === rc.want && rc.heads && !(await p.$("#an-blocked")) && await txt("#anAdds") === "2 in the deck + 0 owned + 0 not owned = 2 cards in the list.", `${label}: a short list adds up too, with no "can't go in" group when there is nothing in it (${await txt("#anAdds")})`);
  await openAn("e"); await p.waitForSelector("#anSum"); await openAll();
  rc = await recon("e");
  ok(/Owned, not in it 0 \| Not owned 1 /.test(await sum()) && /You don't own any of the cards/.test(await txt("#an-owned")) && (await grp("missing")).join("|") === "Elf Thing" && (await grp("blocked")).join("|") === "Card 30" && /Not owned.*Outside this deck's colors/.test(await rowT("blocked", "Card 30")) && rc.once && rc.sum && rc.tiles === rc.want && await txt("#anAdds") === "0 in the deck + 0 owned + 1 not owned + 1 that can't go in this deck = 2 cards in the list.", `${label}: nothing owned to add: it says so; a missing card that is off-color is flagged and not counted (${await sum()})`);
  await openAn("two"); await p.waitForSelector("#anPartner");
  ok(/This deck has two commanders\. The comparison uses Krenko, Mob Boss's list only\./.test(await txt("#anPartner")), `${label}: two commanders: it says only the first one's list is used`);
  await openAn("n"); await p.waitForSelector("#anEmpty");
  ok(/EDHREC's page for Neheb, the Eternal lists no cards\./.test(await txt("#anEmpty")), `${label}: an empty EDHREC page: said to be empty, no groups invented`);
  await openAn("pu"); await p.waitForSelector("#anEmpty");
  ok(/lists no cards/.test(await txt("#anEmpty")) && !(await p.$("#anSum")), `${label}: a page that isn't in the expected shape: treated as having no cards, nothing invented`);
  await openAn("z"); await p.waitForSelector("#anErr");
  ok(/couldn't be loaded/.test(await txt("#anErr")) && !(await p.$("#anSum")) && !!(await p.$("#anRetry")), `${label}: a reply that isn't JSON: reported as not loaded, with Try again`);

  // ---- EDHREC unreachable: with a saved copy, and without
  M.edhDown = true;
  await p.evaluate(async () => { EDH.mem.clear(); for (const k in anState) delete anState[k]; const key = "edh:commanders/krenko-mob-boss", v = await idbGet(key); v.at = Date.now() - 9 * 864e5; await idbSet(key, v); await idbSet("edh:commanders/ezuri-renegade-leader", null); });
  await openAn("k"); await p.waitForSelector("#anSum");
  ok(/Showing statistics saved earlier; EDHREC couldn't be reached just now\./.test(await txt("#anNote")) && /^In your deck 5\/50/.test(await sum()), `${label}: EDHREC unreachable with a saved copy: the saved list is used, with a note`);
  await openAn("e"); await p.waitForSelector("#anErr");
  ok(/EDHREC's statistics couldn't be loaded\./.test(await txt("#anErr")) && /connection problem, not an empty list/.test(await txt("#anErr")) && !(await p.$("#anSum")), `${label}: EDHREC unreachable with nothing saved: it says so and shows no made-up comparison`);
  M.edhDown = false; await p.click("#anRetry"); await p.waitForSelector("#anSum"); ok(/Not owned 1/.test(await sum()), `${label}: Try again works once EDHREC is back`);

  // ---- everything else still works
  await p.evaluate(() => { upgMode.k = "swaps"; deckTab.k = "upgrade"; go("decks", "k"); }); await p.waitForTimeout(1200);
  ok(!(await p.$("#an")) && await p.$eval("#dPane", e => e.textContent.length > 50) && await p.$eval('#uMode [data-u="swaps"]', e => e.getAttribute("aria-pressed") === "true"), `${label}: the existing swap suggestions still open and draw`);
  await p.click('#dTabs [data-t="suggest"]'); await p.waitForSelector("#rPool"); await p.waitForSelector("#rList .item");
  ok(await p.$$eval("#rList .item", a => a.length > 0) && !(await p.$("#uMode")), `${label}: the deck's Suggestions tab still lists cards`);
  await p.click('#dTabs [data-t="cards"]'); await p.waitForSelector('[data-inc]'); const q0 = await p.evaluate(() => deckStats(S.decks.k).mainN);
  await p.click('[data-inc="id-stray-a|0"]'); await p.waitForTimeout(200); await p.click('[data-dec="id-stray-a|0"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => deckStats(S.decks.k).mainN) === q0, `${label}: the deck's own + and − on the Cards tab still work`);
  await p.evaluate(() => { sv.mode = "top50"; go("search"); }); await p.waitForSelector("#tKind"); await p.click('#tMine [data-cmd="Krenko, Mob Boss"]'); await p.waitForSelector("#tRows");
  ok(await p.$$eval("#tRows .item", a => a.length) === 50 && /^Top 50 of 60 cards for Krenko, Mob Boss/.test(await txt("#tSum")), `${label}: the Top 50 browser still works, with the same 50`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: fits the screen`);
  await openAn("k"); await p.waitForSelector("#anSum"); await openAll();
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll("#an .item, #anSum, #uMode")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: with every group open, nothing runs off the side of the screen`);
  ok(!errs.length, `${label}: no page errors` + (errs.length ? ": " + errs[0] : ""));
  ok(!failed.length, `${label}: no failed card or statistics requests other than the ones this test cut off on purpose` + (failed.length ? ": " + failed[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8903", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
