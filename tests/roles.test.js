// Card roles: the corrected classification rules, cost reduction, theme vs creature type, EDHREC lands, the deck checks,
// and updating roles already saved on cards (with a backup and a way back).
// MOCKED: EDHREC and Scryfall are pretend here (routes below). The card texts are typed from memory of the real cards'
// Oracle text, not fetched from Scryfall, so a wording difference on the real card is possible.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const T = {   // name: [type, mana value, rules text, extra]
  "Chaos Warp": ["Instant", 3, "The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield."],
  "Cyclonic Rift": ["Instant", 2, "Return target nonland permanent you don't control to its owner's hand.\nOverload {6}{U} (You may cast this spell for its overload cost. If you do, change \"target\" in its text to \"each.\")"],
  "Comet Storm": ["Instant", 2, "Multikicker {1}\nChoose any target, then choose another target for each time Comet Storm was kicked. Comet Storm deals X damage to each of them."],
  "Crackle with Power": ["Sorcery", 2, "Crackle with Power deals five times X damage to each of up to X targets."],
  "Jaya's Immolating Inferno": ["Legendary Sorcery", 2, "(You may cast a legendary sorcery only if you control a legendary creature or planeswalker.)\nJaya's Immolating Inferno deals X damage to each of up to three targets."],
  "Massive Raid": ["Instant", 3, "Massive Raid deals damage to any target equal to the number of creatures you control."],
  "Hobgoblin Bandit Lord": ["Creature — Goblin Rogue", 3, "Other Goblins you control get +1/+1.\n{R}, {T}: Hobgoblin Bandit Lord deals damage equal to the number of Goblins that entered the battlefield under your control this turn to any target."],
  "Surgehacker Mech": ["Artifact — Vehicle", 4, "Menace\nWhen Surgehacker Mech enters the battlefield, it deals damage equal to twice the number of Vehicles you control to target creature or planeswalker an opponent controls.\nCrew 4"],
  "Dispatch": ["Instant", 1, "Tap target creature.\nMetalcraft — If you control three or more artifacts, exile that creature."],
  "Organic Extinction": ["Sorcery", 10, "Improvise\nDestroy all nonartifact creatures."],
  "Aetherize": ["Instant", 4, "Return all attacking creatures to their owner's hand."],
  "Swan Song": ["Instant", 1, "Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying."],
  "Stroke of Genius": ["Instant", 3, "Target player draws X cards."],
  "Blue Sun's Zenith": ["Instant", 3, "Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library."],
  "Windfall": ["Sorcery", 3, "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way."],
  "Goblin Ringleader": ["Creature — Goblin", 4, "Haste\nWhen Goblin Ringleader enters the battlefield, reveal the top four cards of your library. Put all Goblin cards revealed this way into your hand and the rest on the bottom of your library in any order."],
  "Goblin Matron": ["Creature — Goblin", 3, "When Goblin Matron enters the battlefield, you may search your library for a Goblin card, reveal that card, put it into your hand, then shuffle."],
  "Goblin Recruiter": ["Creature — Goblin", 2, "When Goblin Recruiter enters the battlefield, search your library for any number of Goblin cards and reveal those cards. Shuffle, then put them on top of your library in any order."],
  "Past in Flames": ["Sorcery", 4, "Each instant and sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost.\nFlashback {4}{R}"],
  "Mizzix's Mastery": ["Sorcery", 4, "Exile target card that's an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Mizzix's Mastery.\nOverload {5}{R}{R}{R}"],
  "Emry, Lurker of the Loch": ["Legendary Creature — Merfolk Wizard", 3, "This spell costs {1} less to cast for each artifact you control.\nWhen Emry, Lurker of the Loch enters the battlefield, mill four cards.\n{T}: Choose target artifact card in your graveyard. You may cast that card this turn."],
  "Dance of the Manse": ["Sorcery", 2, "Return up to X target artifact and/or non-Aura enchantment cards each with mana value X or less from your graveyard to the battlefield. If X is 6 or more, those permanents are 4/4 creatures in addition to their other types."],
  "Supreme Verdict": ["Sorcery", 4, "This spell can't be countered.\nDestroy all creatures."],
  "Dovin's Veto": ["Instant", 2, "This spell can't be countered.\nCounter target noncreature spell."],
  "Niv-Mizzet, Parun": ["Legendary Creature — Dragon Wizard", 6, "This spell can't be countered.\nFlying\nWhenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card."],
  "Boggart Shenanigans": ["Kindred Enchantment — Goblin", 3, "Whenever another Goblin you control is put into a graveyard from the battlefield, you may have Boggart Shenanigans deal 1 damage to target player or planeswalker."],
  "Goblin War Strike": ["Sorcery", 1, "Goblin War Strike deals damage equal to the number of Goblins you control to target player or planeswalker."],
  "Cloudshift": ["Instant", 1, "Exile target creature you control, then return that card to the battlefield under your control."],
  "Hexing Squelcher": ["Creature — Goblin Sorcerer", 2, "This spell can't be countered.\nWard—Pay 2 life.\nSpells you control can't be countered.\nOther creatures you control have \"Ward—Pay 2 life.\""],
  "Lightning Greaves": ["Artifact — Equipment", 2, "Equipped creature has haste and shroud.\nEquip {0}"],
  "Padeem, Consul of Innovation": ["Legendary Creature — Vedalken Artificer", 4, "Artifacts you control have hexproof.\nAt the beginning of your upkeep, if you control the artifact with the highest mana value or tied for the highest mana value, draw a card."],
  "Heroic Intervention": ["Instant", 2, "Permanents you control gain hexproof and indestructible until end of turn."],
  "Goblin Warchief": ["Creature — Goblin Warrior", 3, "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste."],
  "Ruby Medallion": ["Artifact", 2, "Red spells you cast cost {1} less to cast."],
  "Baral, Chief of Compliance": ["Legendary Creature — Human Wizard", 2, "Instant and sorcery spells you cast cost {1} less to cast.\nWhenever a spell or ability you control counters a spell, you may draw a card. If you do, discard a card."],
  "Etherium Sculptor": ["Artifact Creature — Vedalken Artificer", 2, "Artifact spells you cast cost {1} less to cast."],
  "Mizzix of the Izmagnus": ["Legendary Creature — Goblin Wizard", 4, "Whenever you cast an instant or sorcery spell with mana value greater than the number of experience counters you have, you get an experience counter.\nInstant and sorcery spells you cast cost {1} less to cast for each experience counter you have."],
  "Blasphemous Act": ["Sorcery", 9, "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature."],
  "Thoughtcast": ["Sorcery", 5, "Affinity for artifacts\nDraw two cards."],
  "Sol Ring": ["Artifact", 1, "{T}: Add {C}{C}.", { produced_mana: ["C"] }],
  "Pull from Tomorrow": ["Instant", 2, "Draw X cards, then discard a card."],
  "Finale of Revelation": ["Sorcery", 2, "Draw X cards. If X is 10 or more, instead shuffle your graveyard into your library, draw X cards, untap up to five lands, and you have no maximum hand size for the rest of the game.\nExile Finale of Revelation."],
  "Faithless Looting": ["Sorcery", 1, "Draw two cards, then discard two cards.\nFlashback {2}{R}"],
  "Frantic Search": ["Instant", 3, "Draw two cards, then discard two cards. Untap up to three lands."],
  "Mystic Confluence": ["Instant", 5, "Choose three. You may choose the same mode more than once.\n• Counter target spell unless its controller pays {3}.\n• Return target creature to its owner's hand.\n• Draw a card."],
  "Solemn Simulacrum": ["Artifact Creature — Golem", 4, "When Solemn Simulacrum enters the battlefield, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen Solemn Simulacrum dies, you may draw a card."],
  "Lightning Bolt": ["Instant", 1, "Lightning Bolt deals 3 damage to any target."],
  "Swords to Plowshares": ["Instant", 1, "Exile target creature. Its controller gains life equal to its power."],
  "Counterspell": ["Instant", 2, "Counter target spell."],
  "Mech Hangar": ["Land", 0, "{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Pilot or Vehicle spell or activate a crew ability.", { produced_mana: ["C", "W"] }],
  "Mountain": ["Basic Land — Mountain", 0, "({T}: Add {R}.)", { produced_mana: ["R"] }],
  "Krenko, Mob Boss": ["Legendary Creature — Goblin Warrior", 4, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control."],
  "Shorikai, Genesis Engine": ["Legendary Artifact — Vehicle", 4, "{1}, {T}: Draw two cards, then discard a card. Create a 1/1 colorless Pilot creature token with \"This creature crews Vehicles as though its power were 2 greater.\"\nCrew 8\nShorikai, Genesis Engine can be your commander."],
  "Goblin Guide": ["Creature — Goblin Scout", 1, "Haste"],
  "Smuggler's Copter": ["Artifact — Vehicle", 2, "Flying\nWhenever Smuggler's Copter attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1"],
  "Plain Rock": ["Artifact", 2, "{T}: Add {C}.", { produced_mana: ["C"] }], "Plain Draw": ["Sorcery", 3, "Draw two cards."], "Plain Answer": ["Instant", 2, "Destroy target creature."],
  "Plain Wipe": ["Sorcery", 4, "Destroy all creatures."], "Plain Ward": ["Instant", 1, "Target creature you control gains hexproof until end of turn."], "Plain Bear": ["Creature — Bear", 3, ""], "Plain Counter": ["Instant", 2, "Counter target spell."],
};
const CI = { "Chaos Warp": ["R"], "Cyclonic Rift": ["U"], "Swan Song": ["U"], "Mizzix of the Izmagnus": ["U", "R"], "Shorikai, Genesis Engine": ["W", "U"] };
const card = n => { const [type, cmc, text, x] = T[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [], color_identity: CI[n] || ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: text, keywords: [] }, x || {}); };
const view = (n, num, syn) => ({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: 1000, synergy: syn });
const page = lists => ({ container: { json_dict: { cardlists: lists } }, panels: { taglinks: [] } });
const EDH = {   // Shorikai's pretend page: Mech Hangar comes first in "High Lift Cards" and again in "Lands"; 55 spells above it in synergy
  "commanders/shorikai-genesis-engine": page([{ header: "High Lift Cards", tag: "highliftcards", cardviews: [view("Mech Hangar", 900, 0.01)] }, { header: "Top Cards", tag: "topcards", cardviews: [view("Smuggler's Copter", 950, 0.5)] },
    { header: "Creatures", tag: "creatures", cardviews: [...Array.from({ length: 55 }, (_, i) => view("Spell " + i, 500, 0.4 - i * 0.001)), view("Smuggler's Copter", 950, 0.5)] }, { header: "Lands", tag: "lands", cardviews: [view("Mech Hangar", 900, 0.01), view("Mountain", 990, 0)] }]),
};
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], M = { sf: [] };
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => { const k = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""), v = EDH[k];
    return v === undefined ? r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }) : r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(v) }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; M.sf.push(ids.map(i => i.name || i.id)); return J({ data: ids.map(i => Object.keys(T).find(n => n === i.name || card(n).id === i.id)).filter(Boolean).map(card), not_found: [] }); }
    return J({ data: [] }); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8906/app_real.html"); await p.waitForTimeout(500);
  const helpers = () => p.evaluate(T => { window.CARD = n => { const [type, cmc, text, x] = T[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [], color_identity: ["R"], prices: {}, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "", normal: "" }, oracle_text: text, keywords: [] }, x || {}); };
    window.ROLES_OF = n => slim(CARD(n)).roles; window.KINDS = n => { const c = CARD(n); return optKinds({ text: c.oracle_text, type: c.type_line, kw: [], mana: c.produced_mana || [] }, slim(c)); }; }, T);
  await helpers();
  const roles = n => p.evaluate(n => ROLES_OF(n), n), kinds = n => p.evaluate(n => KINDS(n), n), has = async (n, r) => (await roles(n)).includes(r);
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());

  // ---- 1. the cards the audit found missed (classified from their rules text: no card names in the rules)
  for (const n of ["Chaos Warp", "Cyclonic Rift", "Comet Storm", "Crackle with Power", "Jaya's Immolating Inferno", "Massive Raid", "Hobgoblin Bandit Lord", "Surgehacker Mech", "Dispatch"]) ok(await has(n, "Removal"), `${label}: ${n} is removal (${await roles(n)})`);
  for (const n of ["Organic Extinction", "Aetherize", "Cyclonic Rift"]) ok(await has(n, "Board wipe"), `${label}: ${n} is a board wipe`);
  ok(await has("Swan Song", "Counterspell"), `${label}: Swan Song is a counterspell`);
  for (const n of ["Stroke of Genius", "Blue Sun's Zenith", "Windfall", "Goblin Ringleader"]) ok(await has(n, "Card draw"), `${label}: ${n} is card draw`);
  for (const n of ["Goblin Matron", "Goblin Recruiter"]) ok(await has(n, "Tutor") && !(await has(n, "Card draw")), `${label}: ${n} is a tutor, not card draw`);
  for (const n of ["Past in Flames", "Mizzix's Mastery", "Emry, Lurker of the Loch", "Dance of the Manse"]) ok(await has(n, "Recursion"), `${label}: ${n} is recursion`);
  ok(!(await p.evaluate(() => cardRoles.toString().includes("Chaos Warp") || cardRoles.toString().includes("Swan Song"))), `${label}: the rules name no card: they read what the text says`);
  // ---- 2. false positives
  for (const n of ["Supreme Verdict", "Dovin's Veto", "Niv-Mizzet, Parun"]) ok(!(await has(n, "Protection")), `${label}: ${n} is not protection just because it can't be countered (${await roles(n)})`);
  ok(await has("Supreme Verdict", "Board wipe") && await has("Dovin's Veto", "Counterspell"), `${label}: they keep their real roles (board wipe, counterspell)`);
  for (const n of ["Boggart Shenanigans", "Goblin War Strike", "Cloudshift"]) ok(!(await has(n, "Removal")), `${label}: ${n} is not removal (${await roles(n)})`);
  for (const [n, sc] of [["Hexing Squelcher", "board"], ["Lightning Greaves", "one"], ["Padeem, Consul of Innovation", "board"], ["Heroic Intervention", "board"]]) ok(await has(n, "Protection") && (await kinds(n)).scope === sc, `${label}: ${n} protects (${sc})`);
  ok((await kinds("Hexing Squelcher")).how.includes("your spells can't be countered") && !(await kinds("Supreme Verdict")).how.length, `${label}: "your spells can't be countered" is told apart from "this spell can't be countered"`);
  // ---- 3. several roles on one card
  for (const [n, want] of [["Mystic Confluence", "Card draw,Removal,Counterspell"], ["Solemn Simulacrum", "Ramp,Card draw,Creature"], ["Cyclonic Rift", "Removal,Board wipe"], ["Niv-Mizzet, Parun", "Card draw,Removal,Creature"]]) ok((await roles(n)).join() === want, `${label}: ${n}: ${want} (${await roles(n)})`);
  // ---- 4. cost reduction is not ramp
  for (const [n, what] of [["Goblin Warchief", "goblin spells"], ["Ruby Medallion", "red spells"], ["Baral, Chief of Compliance", "instant and sorcery spells"], ["Etherium Sculptor", "artifact spells"], ["Mizzix of the Izmagnus", "instant and sorcery spells"]])
    ok((await kinds(n)).cost === what && !(await has(n, "Ramp")), `${label}: ${n} reduces ${what}, and is not counted as ramp`);
  for (const n of ["Blasphemous Act", "Thoughtcast", "Emry, Lurker of the Loch", "Sol Ring"]) ok((await kinds(n)).cost === "", `${label}: ${n} is not a cost reducer (it only makes itself cheaper, or adds mana)`);
  ok(await has("Sol Ring", "Ramp"), `${label}: Sol Ring is still ramp`);
  // ---- 5. draw versus filtering
  for (const [n, k] of [["Pull from Tomorrow", "direct"], ["Finale of Revelation", "direct"], ["Faithless Looting", "loot"], ["Frantic Search", "loot"], ["Stroke of Genius", "direct"]]) ok((await kinds(n)).draw === k, `${label}: ${n}: ${k} (${(await kinds(n)).draw})`);
  // ---- 6. removal kinds the deck checks rely on
  ok((await kinds("Chaos Warp")).rem.join() === "flex" && (await kinds("Comet Storm")).rem.join() === "creature,pw" && (await kinds("Dispatch")).rem.join() === "creature" && (await kinds("Surgehacker Mech")).rem.join() === "creature,pw", `${label}: what each removal spell can hit`);
  ok((await kinds("Cyclonic Rift")).rem.join() === "temp" && (await kinds("Cyclonic Rift")).bounceAny && (await kinds("Cyclonic Rift")).wipeAE, `${label}: Cyclonic Rift: a bounce that can hit any nonland permanent, and an overloaded wipe`);
  ok((await kinds("Past in Flames")).rec === "cast" && (await kinds("Emry, Lurker of the Loch")).rec === "cast" && (await kinds("Dance of the Manse")).rec === "battlefield", `${label}: recursion by kind`);

  // ---- 7. theme versus creature type; theme support needs positive synergy
  const th = await p.evaluate(() => {
    const mk = (cmd, theme, names) => { const d = { id: "", name: "t", format: "commander", cmdr: [], cards: {}, themes: theme ? [theme] : [], created: 1, updated: 1 }; addToDeck(d, CARD(cmd), 1, false, true); d.cmdr = Object.keys(d.cards); for (const n of names) addToDeck(d, CARD(n), 1, false, true); return d; };
    for (const n of ["Krenko, Mob Boss", "Mizzix of the Izmagnus", "Shorikai, Genesis Engine", "Goblin Guide", "Smuggler's Copter", "Lightning Bolt", "Swords to Plowshares", "Stroke of Genius"]) { const c = CARD(n); OPT.text.set(n, { text: c.oracle_text, type: c.type_line, kw: [], mana: [] }); }
    const E = (theme, ts) => ({ cmd: "", theme, R: null, stat: new Map(), tstat: new Map(ts.map(([n, s]) => [n, { name: n, syn: s }])) });
    const a = optAnalyze(mk("Mizzix of the Izmagnus", "Spellslinger", ["Stroke of Genius", "Lightning Bolt"]), E("Spellslinger", [["Stroke of Genius", 0.4], ["Lightning Bolt", -0.1]]));
    const b = optAnalyze(mk("Krenko, Mob Boss", "Goblins", ["Goblin Guide", "Lightning Bolt", "Swords to Plowshares"]), E("Goblins", [["Goblin Guide", 0.5], ["Swords to Plowshares", -0.15]]));
    const c = optAnalyze(mk("Shorikai, Genesis Engine", "Vehicles", ["Smuggler's Copter"]), E("Vehicles", []));
    return { a: a.syn.tribes, aT: a.syn.onTheme.map(r => r.name), aAny: a.syn.onThemeAny.length, b: b.syn.tribes, bTribe: b.syn.tribe.map(r => r.name), bT: b.syn.onTheme.map(r => r.name), c: c.syn.tribes, cut: a.cmdCost.map(r => r.cost) };
  });
  ok(th.a.length === 0, `${label}: the theme Spellslinger is not taken for a creature type (${th.a})`);
  ok(th.c.length === 0, `${label}: nor is Vehicles (an artifact type), nor Shorikai's own Vehicle type`);
  ok(th.b.join() === "Goblin" && th.bTribe.join() === "Goblin Guide", `${label}: Goblins is a creature type of cards in the deck, so it is counted (${th.bTribe})`);
  ok(th.aT.join() === "Stroke of Genius" && th.aAny === 2 && th.bT.join() === "Goblin Guide", `${label}: a card on the theme's list counts as theme support only with positive synergy (Lightning Bolt, Swords to Plowshares don't)`);
  ok(th.cut.join() === "instant and sorcery spells", `${label}: the commander's own cost reduction is found`);

  // ---- 8. EDHREC lands: a land listed first under "High Lift Cards" is still a land
  const edhl = await p.evaluate(async () => { const e = await edhGet("commanders/shorikai-genesis-engine"); const R = await loadTop50({ kind: "commander", cmd: "Shorikai, Genesis Engine", theme: "" });
    return { hangar: e.data.cards.find(c => c.name === "Mech Hangar").list, copter: e.data.cards.find(c => c.name === "Smuggler's Copter").list, lands: R.lands.map(r => r.name), top: R.rows.map(r => r.name), n: R.rows.length }; });
  ok(edhl.hangar === "Lands" && edhl.copter === "Creatures", `${label}: a card's list is its own kind (Lands, Creatures), not the general list it appeared in first (${edhl.hangar}, ${edhl.copter})`);
  ok(edhl.lands.join() === "Mountain,Mech Hangar" && !edhl.top.includes("Mech Hangar") && edhl.top[0] === "Smuggler's Copter" && edhl.n === 50, `${label}: so Mech Hangar is in the Lands section, and the Top 50 and its order are unchanged (${edhl.lands})`);

  // ---- 9. the deck checks: lands, ramp, board wipes, protection weighed against the deck's own numbers
  const chk = await p.evaluate(() => {
    const deck = (spec, lands) => { const d = { id: "", name: "t", format: "commander", cmdr: [], cards: {}, themes: [], created: 1, updated: 1 }; addToDeck(d, CARD("Krenko, Mob Boss"), 1, false, true); d.cmdr = Object.keys(d.cards);
      addToDeck(d, CARD("Mountain"), lands, false, true); for (const [n, q] of spec) addToDeck(d, CARD(n), q, false, true); return d; };
    for (const n of ["Plain Rock", "Plain Draw", "Plain Answer", "Plain Wipe", "Plain Ward", "Plain Bear", "Plain Counter", "Goblin Warchief", "Ruby Medallion", "Mountain", "Krenko, Mob Boss"]) { const c = CARD(n); OPT.text.set(n, { text: c.oracle_text, type: c.type_line, kw: [], mana: c.produced_mana || [] }); }
    const E = { cmd: "", theme: "", R: null, stat: new Map(), tstat: new Map() };
    const res = (spec, lands) => { const A = optAnalyze(deck(spec, lands), E); return { weak: A.weak.map(w => w.key).join(), notes: A.notes.map(w => w.key).join(), note: A.notes.map(w => w.why).join(" | "), counts: A.weak.map(w => w.counts).join(" | ") }; };
    const base = (o = {}) => [["Plain Rock", o.rock ?? 11], ["Plain Draw", 10], ["Plain Answer", 8], ["Plain Wipe", o.wipe ?? 3], ["Plain Ward", o.ward ?? 3], ["Plain Bear", o.bear ?? 0], ["Plain Counter", o.counter ?? 0], ["Goblin Warchief", o.cut ?? 0], ["Ruby Medallion", o.cut2 ?? 0]];
    const fill = (o, lands) => { const s = base(o), n = s.reduce((a, x) => a + x[1], 0); s.push(["Plain Bear", 99 - lands - n - (o.bear ?? 0)]); return res(s.filter(x => x[1] > 0), lands); };
    return {
      land34: fill({}, 34), land31: fill({}, 31), land34few: fill({ rock: 4 }, 34),
      ramp6cut: fill({ rock: 6, cut: 2, cut2: 1 }, 36), ramp4cut: fill({ rock: 4, cut: 1, cut2: 1 }, 36),
      wipeWide: fill({ wipe: 0 }, 36), wipeControl: res([["Plain Rock", 11], ["Plain Draw", 20], ["Plain Answer", 20], ["Plain Ward", 3], ["Plain Bear", 9]], 36),
      protCounter: fill({ ward: 1, counter: 4 }, 36), protNone: fill({ ward: 1 }, 36),
    };
  });
  ok(!chk.land34.weak.includes("land") && chk.land34.notes === "land" && /11 ramp sources, and an average mana value of/.test(chk.land34.note), `${label}: 34 lands with 11 ramp and a low curve: worth a look, not a weakness (${chk.land34.weak}|${chk.land34.notes})`);
  ok(chk.land31.weak.includes("land") && !chk.land31.notes, `${label}: 31 lands is a weakness however much ramp there is`);
  ok(chk.land34few.weak.includes("land") && chk.land34few.weak.includes("ramp"), `${label}: 34 lands with little ramp is a weakness`);
  ok(chk.ramp6cut.notes.includes("ramp") && !chk.ramp6cut.weak.includes("ramp") && /3 cost reducers \(Goblin Warchief, Ruby Medallion\)|cost reducers? \(/.test(chk.ramp6cut.note), `${label}: 6 ramp + 3 cost reducers: worth a look, and the reducers are named (${chk.ramp6cut.note.slice(0, 90)})`);
  ok(chk.ramp4cut.weak.includes("ramp") && /Cost reducers \(2\) aren't counted as ramp/.test(chk.ramp4cut.counts), `${label}: 4 ramp + 2 reducers: still a weakness, and it says the reducers aren't counted (${chk.ramp4cut.counts.slice(0, 120)})`);
  ok(!chk.wipeWide.weak.includes("board-wipe") && chk.wipeWide.notes.includes("board-wipe") && /would hit this deck's own board/.test(chk.wipeWide.note), `${label}: a creature deck with no board wipe: worth a look, not a weakness`);
  ok(chk.wipeControl.weak.includes("board-wipe"), `${label}: a deck with few creatures and no board wipe: a weakness (${chk.wipeControl.weak})`);
  ok(chk.protCounter.notes.includes("protection") && /4 counterspells/.test(chk.protCounter.note) && chk.protNone.weak.includes("protection"), `${label}: little protection but four counterspells: worth a look; with none: a weakness`);

  // ---- 10. roles saved under the older rules: found, updated with a backup, put back
  await p.evaluate(() => {
    S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    const add = (n, q, bin) => addToColl(slim(CARD(n)), "nonfoil", q, bin, true);
    ["Cyclonic Rift", "Swan Song", "Supreme Verdict", "Goblin Matron", "Windfall", "Lightning Bolt"].forEach(n => add(n, 2, "main")); add("Swan Song", 1, "wish");
    const d = { id: "dk", name: "Old roles", format: "commander", cmdr: [], cards: {}, themes: [], created: 1, updated: 5 }; S.decks.dk = d; addToDeck(d, CARD("Krenko, Mob Boss"), 1, false, true); d.cmdr = Object.keys(d.cards);
    for (const n of ["Cyclonic Rift", "Swan Song", "Supreme Verdict", "Goblin Matron", "Lightning Bolt"]) addToDeck(d, CARD(n), 1, false, true);
    const o = { id: "o2", name: "Other deck", format: "commander", cmdr: [], cards: {}, themes: [], created: 1, updated: 4 }; S.decks.o2 = o; addToDeck(o, CARD("Supreme Verdict"), 1, false, true); addToDeck(o, CARD("Windfall"), 1, false, true);
    // what the older rules had saved
    const OLD = { "Cyclonic Rift": ["Removal"], "Swan Song": [], "Supreme Verdict": ["Board wipe", "Protection"], "Goblin Matron": [], "Windfall": [] };
    for (const e of Object.values(S.coll)) if (OLD[e.name]) e.roles = OLD[e.name].slice();
    for (const dd of [d, o]) for (const c of Object.values(dd.cards)) if (OLD[c.name]) c.roles = OLD[c.name].slice();
    S.roles = { "Goblin Matron": ["Tutor", "Creature", "Card draw"] };          // your own fix: never touched
    S.lists = S.lists || {}; S.lists.L1 = { id: "L1", name: "Order", items: [{ name: "Swan Song", qty: 1, card: Object.assign(slim(CARD("Swan Song")), { roles: [] }) }] };
    save();
  });
  await p.waitForTimeout(400);
  const snap = () => p.evaluate(() => { const strip = o => { const c = Object.assign({}, o); delete c.roles; return c; };
    return JSON.stringify({ coll: Object.fromEntries(Object.entries(S.coll).map(([k, e]) => [k, strip(e)])), decks: Object.fromEntries(Object.entries(S.decks).map(([id, d]) => [id, Object.assign({}, d, { cards: Object.fromEntries(Object.entries(d.cards).map(([k, c]) => [k, strip(c)])) })])), fixes: S.roles, lists: S.lists, rest: Object.keys(S).sort() }); });
  const rolesNow = () => p.evaluate(() => JSON.stringify({ coll: Object.values(S.coll).map(e => e.name + ":" + (e.roles || []).join("+")).sort(), dk: Object.values(S.decks.dk.cards).map(c => c.name + ":" + (c.roles || []).join("+")).sort(), o2: Object.values(S.decks.o2.cards).map(c => c.name + ":" + (c.roles || []).join("+")).sort() }));
  const before = await snap(), rolesOld = await rolesNow(), qty0 = await p.evaluate(() => Object.values(S.coll).map(e => e.qty).join());
  await p.evaluate(() => { deckTab.dk = "balance"; balMode.dk = "optimize"; go("decks", "dk"); }); await p.waitForSelector("#opStale");
  ok(/4 cards in this deck have roles saved under Deckhand's older rules/.test(await txt("#opStale")), `${label}: the analysis finds the 4 deck cards whose saved roles differ from the current rules (${(await txt("#opStale")).slice(0, 90)})`);
  ok(await p.$eval("#opNWipe", e => +e.textContent) === 2 && await p.$eval("#opNProt", e => +e.textContent) === 0, `${label}: and already reads them with the current rules (2 board wipes, no false protection)`);
  ok(await p.evaluate(() => deckGaps(S.decks.dk).n.Protection === 1), `${label}: the Role balance view still uses the saved roles until they are updated`);
  await p.click("#opRoleDeck"); await p.waitForFunction(() => !document.querySelector("#opRoleDeck"), null, { timeout: 8000 });
  const rolesNew = JSON.parse(await rolesNow());
  ok(rolesNew.dk.includes("Cyclonic Rift:Removal+Board wipe") && rolesNew.dk.includes("Swan Song:Counterspell") && rolesNew.dk.includes("Supreme Verdict:Board wipe"), `${label}: the deck's cards now carry the current roles (${rolesNew.dk.join(" ")})`);
  ok(rolesNew.coll.filter(x => /^Swan Song:Counterspell$/.test(x)).length === 2 && rolesNew.o2.includes("Supreme Verdict:Board wipe"), `${label}: and so do the same cards in the collection (wishlist copy too) and in other decks`);
  ok(rolesNew.dk.includes("Goblin Matron:Tutor+Creature") && await p.evaluate(() => JSON.stringify(S.roles["Goblin Matron"])) === '["Tutor","Creature","Card draw"]', `${label}: your own fix (Goblin Matron) is left as it is, and still wins`);
  ok(rolesNew.o2.includes("Windfall:") && rolesNew.coll.includes("Windfall:"), `${label}: a card that isn't in this deck (Windfall) isn't touched by "this deck's cards"`);
  ok(await snap() === before, `${label}: apart from roles, every collection entry, deck card, deck, your fixes and the order lists are exactly as they were`);
  ok(await p.evaluate(() => Object.values(S.coll).map(e => e.qty).join()) === qty0 && await p.evaluate(() => S.lists.L1.items[0].card.roles.length === 0), `${label}: quantities unchanged; the copy inside an order list (not used for roles) is left alone`);
  const bk = await p.evaluate(async () => { const b = await idbGet("rolesBackup"); return b && { n: b.items.length, rift: b.items.filter(x => x.name === "Cyclonic Rift").map(x => x.roles.join("+")) }; });
  ok(bk && bk.n === 10 && bk.rift.every(x => x === "Removal"), `${label}: a backup of the 10 changed records' old roles is kept on this device (${bk && bk.n})`);
  const gp = await p.evaluate(() => JSON.stringify(deckGaps(S.decks.dk).n));
  ok(!JSON.parse(gp).Protection && JSON.parse(gp)["Board wipe"] === 2, `${label}: the Role balance view now agrees (${gp})`);
  // the backup survives a reload, and puts everything back
  await p.waitForTimeout(600); await p.reload(); await p.waitForTimeout(600); await helpers();
  await p.evaluate(() => { deckTab.dk = "balance"; balMode.dk = "optimize"; go("decks", "dk"); }); await p.waitForSelector("#opRoleUndo");
  await p.click("#opRoleUndo"); await p.waitForFunction(() => !document.querySelector("#opRoleUndo"), null, { timeout: 8000 });
  ok(await rolesNow() === rolesOld && await snap() === before, `${label}: after a reload, "Put back the earlier roles" restores every old role exactly, and nothing else changed`);
  ok(await p.evaluate(async () => !(await idbGet("rolesBackup"))), `${label}: and the backup is cleared`);
  // all your cards: collection-only names too
  await p.waitForSelector("#opRoleAll"); await p.click("#opRoleAll"); await p.waitForFunction(() => !document.querySelector("#opRoleAll"), null, { timeout: 8000 });
  const all = JSON.parse(await rolesNow());
  ok(all.coll.includes("Windfall:Card draw") && all.o2.includes("Windfall:Card draw") && await snap() === before, `${label}: "Update all your cards" also updates cards in no open deck (Windfall), and still changes nothing else`);
  // a lookup cached before the rules changed is looked up again
  const re = await p.evaluate(async () => { const m = await cardCache(); const sl = slim(CARD("Swan Song")); sl.roles = []; m.set(identKey({ name: "Swan Song" }), { c: sl, t: ROLE_RULES_AT - 1000 }); CC.miss.clear(); return true; });
  const n0 = M.sf.length; const got = await p.evaluate(async () => (await lookupCards([{ name: "Swan Song" }]))[identKey({ name: "Swan Song" })].roles.join());
  ok(M.sf.length === n0 + 1 && got === "Counterspell", `${label}: a card lookup saved before the rules changed is fetched again (${got})`);
  // ---- 11. layout
  await p.evaluate(() => { S.decks.dk.cards[Object.keys(S.decks.dk.cards).find(k => S.decks.dk.cards[k].name === "Swan Song")].roles = []; delete optState.dk; renderDeck(S.decks.dk); }); await p.waitForSelector("#opStale");
  await p.$$eval("#op details", a => a.forEach(d => { d.open = true; }));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll("#opStale, #opStale button, #op-cost, #op .op-card, #opNotes")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: the role notice, its buttons and the cost-reduction section fit the screen`);
  if (process.env.SHOTS) await p.screenshot({ path: `/tmp/roles_${label}.png`, fullPage: true });
  ok(!errs.length, `${label}: no page errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8906", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
