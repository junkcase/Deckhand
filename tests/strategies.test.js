// Deck analysis → Strategies (synergy roles): what strategy or mechanic each card supports, read from its rules text.
// MOCKED: Scryfall and EDHREC are pretend (routes below). Card texts are typed from memory of the real cards' Oracle text
// (from EDHREC's Krenko, Mizzix and Shorikai average decks used in the audit), not fetched. "Test Relic" is invented for one check.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const T = {
  "Krenko, Mob Boss": ["Legendary Creature — Goblin Warrior", 4, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control."],
  "Mizzix of the Izmagnus": ["Legendary Creature — Goblin Wizard", 4, "Whenever you cast an instant or sorcery spell with mana value greater than the number of experience counters you have, you get an experience counter.\nInstant and sorcery spells you cast cost {1} less to cast for each experience counter you have."],
  "Goblin Chieftain": ["Creature — Goblin", 3, "Haste\nOther Goblin creatures you control get +1/+1 and have haste."],
  "Goblin King": ["Creature — Goblin", 3, "Other Goblins get +1/+1 and have mountainwalk."],
  "Goblin Warchief": ["Creature — Goblin Warrior", 3, "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste."],
  "Goblin Matron": ["Creature — Goblin", 3, "When Goblin Matron enters the battlefield, you may search your library for a Goblin card, reveal that card, put it into your hand, then shuffle."],
  "Goblin Piledriver": ["Creature — Goblin Warrior", 2, "Protection from blue\nWhenever Goblin Piledriver attacks, it gets +2/+0 until end of turn for each other attacking Goblin."],
  "Krenko's Command": ["Sorcery", 2, "Create two 1/1 red Goblin creature tokens."],
  "Pashalik Mons": ["Legendary Creature — Goblin Warrior", 3, "Whenever Pashalik Mons or another Goblin you control dies, Pashalik Mons deals 1 damage to any target.\n{3}{R}, Sacrifice a Goblin: Create two 1/1 red Goblin creature tokens."],
  "Skirk Prospector": ["Creature — Goblin", 1, "Sacrifice a Goblin: Add {R}.", { produced_mana: ["R"] }],
  "Skullclamp": ["Artifact — Equipment", 1, "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}"],
  "Goblin Grenade": ["Sorcery", 1, "As an additional cost to cast this spell, sacrifice a Goblin.\nGoblin Grenade deals 5 damage to any target."],
  "Impact Tremors": ["Enchantment", 2, "Whenever a creature enters the battlefield under your control, Impact Tremors deals 1 damage to each opponent."],
  "Blasphemous Act": ["Sorcery", 9, "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature."],
  "Kiki-Jiki, Mirror Breaker": ["Legendary Creature — Goblin Shaman", 5, "Haste\n{T}: Create a token that's a copy of target nonlegendary creature you control, except it has haste. Sacrifice it at the beginning of the next end step."],
  "Thornbite Staff": ["Kindred Artifact — Shaman Equipment", 2, "Equipped creature has \"{2}, {T}: This creature deals 1 damage to any target\" and \"Whenever a creature dies, untap this creature.\"\nWhenever a Shaman creature enters the battlefield, you may attach Thornbite Staff to it.\nEquip {4}"],
  "Staff of Domination": ["Artifact", 3, "{1}: Untap Staff of Domination.\n{2}, {T}: You gain 1 life.\n{3}, {T}: Untap target creature.\n{4}, {T}: Tap target creature.\n{5}, {T}: Draw a card."],
  "Faithless Looting": ["Sorcery", 1, "Draw two cards, then discard two cards.\nFlashback {2}{R}", { keywords: ["Flashback"] }],
  "Hazoret's Monument": ["Legendary Artifact", 3, "Red creature spells you cast cost {1} less to cast.\nWhenever you cast a creature spell, you may discard a card. If you do, draw a card."],
  "Blood Moon": ["Enchantment", 3, "Nonbasic lands are Mountains."],
  "Grenzo, Havoc Raiser": ["Legendary Creature — Goblin Rogue", 2, "Whenever a creature you control deals combat damage to a player, choose one —\n• Goad target creature that player controls.\n• Exile the top card of that player's library. Until end of turn, you may cast that card and you may spend mana as though it were mana of any color to cast that spell."],
  "Storm-Kiln Artist": ["Creature — Dwarf Shaman", 4, "Storm-Kiln Artist gets +1/+0 for each artifact you control.\nMagecraft — Whenever you cast or copy an instant or sorcery spell, create a Treasure token."],
  "Harmonic Prodigy": ["Creature — Human Wizard", 2, "Prowess\nIf an ability of a Shaman or another Wizard you control triggers, that ability triggers an additional time.", { keywords: ["Prowess"] }],
  "Big Score": ["Instant", 4, "As an additional cost to cast this spell, discard a card.\nDraw two cards and create two Treasure tokens."],
  "Frantic Search": ["Instant", 3, "Draw two cards, then discard two cards. Untap up to three lands."],
  "Mystical Tutor": ["Instant", 1, "Search your library for an instant or sorcery card, reveal it, then shuffle and put that card on top."],
  "Reiterate": ["Instant", 3, "Buyback {3}\nCopy target instant or sorcery spell. You may choose new targets for the copy."],
  "Smothering Tithe": ["Enchantment", 4, "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token."],
  "An Offer You Can't Refuse": ["Instant", 1, "Counter target noncreature spell. Its controller creates two Treasure tokens."],
  "Swan Song": ["Instant", 1, "Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying."],
  "Generous Gift": ["Instant", 3, "Destroy target permanent. Its controller creates a 3/3 green Elephant creature token."],
  "Swords to Plowshares": ["Instant", 1, "Exile target creature. Its controller gains life equal to its power."],
  "Path to Exile": ["Instant", 1, "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle."],
  "Voltaic Key": ["Artifact", 1, "{1}, {T}: Untap target artifact."],
  "Unwinding Clock": ["Artifact", 4, "Untap all artifacts you control during each other player's untap step."],
  "Solemn Simulacrum": ["Artifact Creature — Golem", 4, "When Solemn Simulacrum enters the battlefield, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen Solemn Simulacrum dies, you may draw a card."],
  "Cosima, God of the Voyage": ["Legendary Creature — God", 3, "At the beginning of your upkeep, you may exile Cosima. If you do, it gains \"Whenever a land enters the battlefield under your control, if Cosima is exiled, you may put a voyage counter on it. If you don't, return Cosima to the battlefield with X +1/+1 counters on it and draw X cards, where X is the number of voyage counters on it.\""],
  "Kotori, Pilot Prodigy": ["Legendary Creature — Moonfolk Pilot", 3, "Vehicles you control have crew 2.\nAt the beginning of combat on your turn, target artifact creature you control gains lifelink and vigilance until end of turn."],
  "Prodigy's Prototype": ["Artifact — Vehicle", 2, "Whenever one or more Vehicles you control attack, create a 1/1 colorless Pilot creature token with \"This creature crews Vehicles as though its power were 2 greater.\"\nCrew 2"],
  "Sting, the Glinting Dagger": ["Legendary Artifact — Equipment", 2, "Equipped creature gets +1/+1 and has haste.\nAt the beginning of each combat, untap equipped creature.\nEquipped creature has first strike as long as it's blocking or blocked by a Goblin or Orc.\nEquip {2}"],
  "Lightning Greaves": ["Artifact — Equipment", 2, "Equipped creature has haste and shroud.\nEquip {0}"],
  "Weatherlight": ["Legendary Artifact — Vehicle", 4, "Flying\nWhenever Weatherlight deals combat damage to a player, look at the top five cards of your library. You may reveal a historic card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\nCrew 3"],
  "Kor Skyfisher": ["Creature — Kor Soldier", 2, "Flying\nWhen Kor Skyfisher enters the battlefield, return a permanent you control to its owner's hand."],
  "Cloudshift": ["Instant", 1, "Exile target creature you control, then return that card to the battlefield under your control."],
  "Zealous Conscripts": ["Creature — Human Warrior", 5, "Haste\nWhen Zealous Conscripts enters the battlefield, gain control of target permanent until end of turn. Untap that permanent. It gains haste until end of turn."],
  "Elvish Archdruid": ["Creature — Elf Druid", 3, "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.", { produced_mana: ["G"] }],
  "Test Relic": ["Artifact", 2, "{3}, {T}: You gain 2 life."],
  "Mountain": ["Basic Land — Mountain", 0, "({T}: Add {R}.)", { produced_mana: ["R"] }],
};
const CI = { "Mizzix of the Izmagnus": ["U", "R"], "Harmonic Prodigy": ["U", "R"], "Swan Song": ["U"], "Elvish Archdruid": ["G"], "Swords to Plowshares": ["W"], "Path to Exile": ["W"], "Generous Gift": ["W"], "Kotori, Pilot Prodigy": ["U"], "Cosima, God of the Voyage": ["U"], "Kor Skyfisher": ["W"], "Cloudshift": ["W"], "An Offer You Can't Refuse": ["U"] };
const card = n => { const [type, cmc, text, x] = T[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [], color_identity: CI[n] || ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: text, keywords: [] }, x || {}); };
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], M = { combo: 0 };
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://raw.githubusercontent.com/**", r => { M.combo++; return r.fulfill({ status: 404, body: "" }); });              // the combo list must never be downloaded here
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => Object.keys(T).find(n => n === i.name || card(n).id === i.id)).filter(Boolean).map(card), not_found: [] }); }
    return J({ data: [] }); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec|githubusercontent/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8907/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(TT => { window.TT = TT; window.CARD = n => { const [type, cmc, text, x] = TT[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [], color_identity: ["R"], prices: {}, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "", normal: "" }, oracle_text: text, keywords: [] }, x || {}); };
    window.SY = (n, types) => { const c = CARD(n); return optSynergy({ text: c.oracle_text, type: c.type_line, kw: c.keywords || [] }, slim(c), types || []).map(e => `${e.cat}/${e.side}/${e.direct ? "direct" : "incidental"}${e.potential ? "/potential" : ""}`); };
    window.SYQ = (n, types) => { const c = CARD(n); return optSynergy({ text: c.oracle_text, type: c.type_line, kw: c.keywords || [] }, slim(c), types || []); };
    for (const n of Object.keys(TT)) { const c = CARD(n); OPT.text.set(n, { text: c.oracle_text, type: c.type_line, kw: c.keywords || [], mana: c.produced_mana || [] }); } }, T);
  const sy = (n, types) => p.evaluate(([n, t]) => SY(n, t), [n, types || []]), has = async (n, x, types) => (await sy(n, types)).includes(x), none = async (n, cat, types) => !(await sy(n, types)).some(s => s.startsWith(cat + "/"));
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
  const G = ["goblin", "warrior", "shaman", "wizard"];

  // ---- positive examples (audit decks)
  ok(await has("Goblin Chieftain", "type:Goblin/payoff/direct", G) && await has("Goblin King", "type:Goblin/payoff/direct", G) && await has("Goblin Piledriver", "type:Goblin/payoff/direct", G), `${label}: Goblin lords and Goblin Piledriver reward Goblins`);
  ok(await has("Goblin Matron", "type:Goblin/payoff/direct", G) && await has("Krenko's Command", "type:Goblin/enabler/direct", G) && await has("Krenko's Command", "tokens/enabler/direct", G), `${label}: a Goblin tutor rewards Goblins; Krenko's Command makes Goblin tokens`);
  ok(await has("Skirk Prospector", "sacrifice/enabler/direct", G) && await has("Skullclamp", "sacrifice/payoff/direct", G) && await has("Impact Tremors", "gowide/payoff/direct", G), `${label}: a sacrifice outlet, a dies payoff, a creatures-entering payoff`);
  ok(await has("Kiki-Jiki, Mirror Breaker", "copy/enabler/direct", G) && await has("Reiterate", "copy/enabler/direct") && await has("Voltaic Key", "untap/enabler/direct") && await has("Unwinding Clock", "untap/enabler/direct"), `${label}: copy and untap effects`);
  ok(await has("Mystical Tutor", "spells/payoff/direct") && /Finds or reuses instant and sorcery cards/.test(await p.evaluate(() => SYQ("Mystical Tutor")[0].why)), `${label}: Mystical Tutor supports spells, and says it finds them (not that it rewards casting them)`);
  ok(await has("Cosima, God of the Voyage", "landfall/payoff/direct") && await has("Solemn Simulacrum", "landfall/enabler/direct") && await has("Sting, the Glinting Dagger", "voltron/enabler/direct"), `${label}: landfall payoff and enabler; an Equipment that builds up a creature`);
  // ---- several synergy roles on one card
  ok((await sy("Storm-Kiln Artist", G)).sort().join() === "artifacts/enabler/direct,artifacts/payoff/direct,spells/payoff/direct", `${label}: Storm-Kiln Artist: spells payoff, artifacts payoff and enabler (${await sy("Storm-Kiln Artist", G)})`);
  ok((await sy("Pashalik Mons", G)).sort().join() === ["sacrifice/enabler/direct", "sacrifice/payoff/direct", "tokens/enabler/direct", "type:Goblin/enabler/direct", "type:Goblin/payoff/direct"].join(), `${label}: Pashalik Mons: Goblin payoff and maker, sacrifice outlet and payoff, tokens (${(await sy("Pashalik Mons", G)).sort()})`);
  ok((await sy("Mizzix of the Izmagnus", G)).sort().join() === "counters/enabler/direct,counters/payoff/direct,spells/enabler/direct,spells/payoff/direct", `${label}: Mizzix: spells payoff and cost reducer, counters enabler and payoff`);
  // ---- direct versus incidental
  ok(await has("Big Score", "artifacts/enabler/incidental") && await has("Smothering Tithe", "artifacts/enabler/direct"), `${label}: Treasure as a side effect of card draw is incidental; Smothering Tithe's Treasure is direct`);
  ok(await has("Faithless Looting", "graveyard/enabler/incidental") && await has("Faithless Looting", "graveyard/payoff/incidental") && await has("Hazoret's Monument", "graveyard/enabler/direct"), `${label}: Faithless Looting's discard and own flashback are incidental; a permanent that discards again and again is direct`);
  ok(await has("Goblin Grenade", "sacrifice/enabler/incidental", G) && await has("Frantic Search", "untap/enabler/incidental") && await has("Staff of Domination", "lifegain/enabler/incidental") && await has("Staff of Domination", "untap/enabler/direct"), `${label}: a one-shot sacrifice cost on a removal spell, untapping lands on a draw spell, 1 life on an activated ability: incidental`);
  // ---- opponents' tokens and life
  for (const n of ["Swan Song", "Generous Gift"]) ok(await none(n, "tokens"), `${label}: ${n} gives the opponent a token: not a token card`);
  ok(await none("An Offer You Can't Refuse", "artifacts"), `${label}: An Offer You Can't Refuse gives the opponent Treasure: not an artifact card`);
  ok(await none("Swords to Plowshares", "lifegain") && await none("Path to Exile", "landfall"), `${label}: life or a land for the opponent is not lifegain or landfall`);
  // ---- not synergy
  ok(await none("Blasphemous Act", "gowide") && await none("Lightning Greaves", "voltron") && await none("Blood Moon", "") && (await sy("Grenzo, Havoc Raiser", G)).length === 0 && (await sy("Weatherlight", G)).length === 0, `${label}: Blasphemous Act (a cost that counts creatures), Lightning Greaves (protection), Blood Moon, Grenzo, Weatherlight: no strategy`);
  ok(await none("Krenko, Mob Boss", "blink", G) && !(await sy("Goblin Matron", G)).some(x => x.startsWith("type:Goblin/enabler")), `${label}: a card's own name isn't read as a creature type (Goblin Matron doesn't "make Goblins")`);
  // ---- creature types: only those in the deck, each on its own
  ok(await has("Harmonic Prodigy", "type:Wizard/payoff/direct", G) && await none("Elvish Archdruid", "type:Elf", G) && await has("Elvish Archdruid", "type:Elf/payoff/direct", ["elf"]), `${label}: an Elf lord rewards Elves only in a deck with Elves`);
  // regression: Harmonic Prodigy's "a Shaman or another Wizard you control" rewards both types, each on its own
  ok(await has("Harmonic Prodigy", "type:Shaman/payoff/direct", G) && await has("Harmonic Prodigy", "type:Wizard/payoff/direct", G), `${label}: Harmonic Prodigy rewards Shamans and Wizards (${await sy("Harmonic Prodigy", G)})`);
  ok(await has("Harmonic Prodigy", "type:Shaman/payoff/direct", ["shaman"]) && await none("Harmonic Prodigy", "type:Wizard", ["shaman"]) && await has("Harmonic Prodigy", "type:Wizard/payoff/direct", ["wizard"]) && await none("Harmonic Prodigy", "type:Shaman", ["wizard"]), `${label}: each type is recognised independently: only the types this deck's creatures have`);
  ok(/“Shaman or another Wizard you control”/.test(await p.evaluate(() => SYQ("Harmonic Prodigy", ["shaman", "wizard"]).find(e => e.cat === "type:Shaman").quote).then(q => "“" + q + "”")), `${label}: and quotes the words that matched`);
  ok(await has("Thornbite Staff", "type:Shaman/payoff/direct", G) && await none("Thornbite Staff", "type:Shaman", ["goblin"]), `${label}: Shaman synergy only when the deck has Shamans`);

  // ---- the deck: Strategies section
  await p.evaluate(() => {
    const mk = (id, name, cmd, theme, names) => { const d = { id, name, format: "commander", cmdr: [], cards: {}, themes: theme, created: 1, updated: 9 }; S.decks[id] = d; addToDeck(d, CARD(cmd), 1, false, true); d.cmdr = Object.keys(d.cards); for (const [n, q] of names) addToDeck(d, CARD(n), q, false, true); return d; };
    mk("g", "Goblins", "Krenko, Mob Boss", ["Goblins", "Spellslinger", "Control"], [["Mountain", 36], ["Goblin Chieftain", 1], ["Goblin King", 1], ["Goblin Warchief", 1], ["Goblin Matron", 1], ["Goblin Piledriver", 1], ["Krenko's Command", 2], ["Pashalik Mons", 1], ["Skirk Prospector", 1], ["Skullclamp", 1], ["Goblin Grenade", 1], ["Impact Tremors", 1], ["Blasphemous Act", 1], ["Kiki-Jiki, Mirror Breaker", 1], ["Zealous Conscripts", 1], ["Thornbite Staff", 1], ["Staff of Domination", 1], ["Faithless Looting", 1], ["Hazoret's Monument", 1], ["Blood Moon", 1], ["Grenzo, Havoc Raiser", 1], ["Kor Skyfisher", 1], ["Test Relic", 1], ["Elvish Archdruid", 1]]);
    mk("b", "Blink", "Krenko, Mob Boss", ["Blink"], [["Mountain", 36], ["Kor Skyfisher", 1], ["Cloudshift", 1], ["Solemn Simulacrum", 1]]);
    S.roles = { "Blood Moon": ["Protection"] };                                                     // a custom correction: left exactly as it is
    addToColl(slim(CARD("Goblin King")), "nonfoil", 3, "main", true); save();
  });
  await p.waitForTimeout(500);
  const state = () => p.evaluate(async () => JSON.stringify({ S, ls: Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]), base: await idbGet("syncBase").catch(() => null) }));
  const s0 = await state();
  const open = async id => { await p.evaluate(id => { deckTab[id] = "balance"; balMode[id] = "optimize"; go("decks", id); }, id); await p.waitForSelector("#op-strat", { state: "attached" }); await p.$$eval("#op details", a => a.forEach(d => { d.open = true; })); };
  await open("g");
  const cats = () => p.$$eval("#op-strat .op-strat", a => a.map(x => x.querySelector(".label").textContent.trim() + " = " + x.querySelector("summary .num").textContent.trim()));
  const c1 = await cats();
  ok(c1[0] === "Creature type: Goblin = 9 cards · 10 copies · 2 enabling · 8 rewarding", `${label}: Goblin: 9 different cards, 10 copies (two Krenko's Command), counted separately (commander left out) (${c1[0]})`);
  ok(c1.includes("Sacrifice = 4 cards · 4 copies · 2 enabling · 3 rewarding") && c1.includes("Copy effects = 1 card · 1 copy · 1 enabling · 0 rewarding"), `${label}: sacrifice and copy strategies with their counts (${c1.slice(1, 6).join(" | ")})`);
  ok(!c1.some(x => /^Go-wide/.test(x) && /Blasphemous/.test(x)) && !(await p.$$eval("#op-st-gowide .op-card", a => a.map(x => x.dataset.name))).includes("Blasphemous Act"), `${label}: Blasphemous Act is not in Go-wide`);
  ok(c1.includes("Creature type: Elf = 1 card · 1 copy · 0 enabling · 1 rewarding") && c1.indexOf("Creature type: Elf = 1 card · 1 copy · 0 enabling · 1 rewarding") > 0, `${label}: each creature type counts on its own: the one Elf lord is an Elf strategy of its own, apart from the Goblins`);
  const gob = await p.$eval("#op-st-type-goblin", e => e.textContent.replace(/\s+/g, " "));
  ok(/Lord: makes your Goblins stronger · “Other Goblin creatures you control get \+1/.test(gob) && /Rewards playing Goblins · “for each other attacking Goblin”/.test(gob), `${label}: each card says why, quoting its text`);
  ok(/^Your commander supports: Tokens \(enables it\), Creature type: Goblin \(enables and rewards it\)\.$/.test(await txt("#opStratCmd")), `${label}: what the commander supports (${await txt("#opStratCmd")})`);
  // incidental cards are shown, not counted
  const sac = await p.$eval("#op-st-sacrifice", e => e.textContent.replace(/\s+/g, " "));
  ok(/Incidental · 1 card, not counted/.test(sac) && await p.$$eval("#op-st-sacrifice .op-inc .op-card", a => a.map(x => x.dataset.name).join()) === "Goblin Grenade", `${label}: Goblin Grenade's sacrifice cost is listed as incidental and not counted`);
  // blink without an enabler: potential, not counted
  ok(await p.$eval("#opStratQuiet", e => /Blink/.test(e.textContent) && /Potential payoffs · \d+ cards?, not counted/.test(e.textContent) && /this deck has none/.test(e.textContent)), `${label}: without a blink card, enters-the-battlefield cards are potential payoffs, not counted`);
  ok(c1.includes("Blink = not active"), `${label}: and Blink isn't an active strategy`);
  // no role identified: only direct synergy takes a card out
  const unk = await p.$$eval("#op-unknown .op-card", a => a.map(x => x.dataset.name));
  ok(["Grenzo, Havoc Raiser", "Kor Skyfisher", "Test Relic"].every(n => unk.includes(n)) && !unk.includes("Goblin King") && !unk.includes("Impact Tremors") && !unk.includes("Blood Moon"), `${label}: Grenzo (no strategy), Kor Skyfisher (only a potential blink payoff) and Test Relic (only incidental lifegain) stay in No role identified; Goblin King and Impact Tremors leave it; Blood Moon has your own fix (${unk.join(", ")})`);
  // theme mapping
  const th = await p.$$eval("#opStratTheme p", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  ok(/^Your theme Goblins → Creature type: Goblin: 9 cards \(10 copies\): 2 enabling it, 8 rewarding it\.$/.test(th[0]), `${label}: theme Goblins → the Goblin creature type (${th[0]})`);
  ok(/^Your theme Spellslinger → Instants and sorceries: no card in the deck supports it directly\.$/.test(th[1]) && /^Your theme Control has no strategy category here/.test(th[2]), `${label}: Spellslinger → instants and sorceries (none here); Control has no category (${th[1]} | ${th[2]})`);
  ok(await p.evaluate(() => [themeSyn("Vehicles", new Set()), themeSyn("+1/+1 Counters", new Set()), themeSyn("Elves", new Set()), themeSyn("Wizards", new Set(["wizard"])), themeSyn("Shamans", new Set(["shaman"])), themeSyn("Kicker", new Set())].join()) === "artifacts,counters,type:Elf,type:Wizard,type:Shaman,", `${label}: the fixed mapping, and a theme named after a creature type in the deck`);
  // multi-strategy cards
  ok((await p.$$eval("#opStratMulti .op-card", a => a.map(x => x.dataset.name))).includes("Pashalik Mons"), `${label}: cards supporting more than one strategy are listed`);
  // ---- combo data: not saved → not checked, nothing downloaded
  ok(/isn't saved on this device\. Open the Combos tab once/.test(await txt("#opCombo")) && !c1.some(x => /^Combo/.test(x)) && M.combo === 0, `${label}: without a saved combo list, combos aren't checked and nothing is downloaded (${M.combo} requests)`);
  // ---- saved combo list: used
  await p.evaluate(async () => { await idbSet("combos", { as_of: "2026-11-01", data: { cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts", "Pestermite"], feats: ["Infinite hasty tokens"], tmpl: [], combos: [["k1", [0, 1], [0], [], 999, "R"], ["k2", [0, 2], [0], [], 500, "UR"]] } });
    CMB_LOCAL.tried = false; CMB_LOCAL.data = null; delete optState.g; renderDeck(S.decks.g); });
  await p.waitForSelector("#op-st-combo", { state: "attached" }); await p.$$eval("#op details", a => a.forEach(d => { d.open = true; }));
  ok(/^1 combo from Commander Spellbook is complete in this deck/.test(await txt("#opCombo")) && (await p.$$eval("#op-st-combo .op-card", a => a.map(x => x.dataset.name))).join() === "Kiki-Jiki, Mirror Breaker,Zealous Conscripts" && M.combo === 0, `${label}: with the combo list saved on the device, its pieces are shown (Kiki-Jiki + Zealous Conscripts), still with no download`);
  ok(!(await p.$$eval("#op-unknown .op-card", a => a.map(x => x.dataset.name))).includes("Zealous Conscripts"), `${label}: a combo piece leaves No role identified`);
  // ---- with a blink enabler, blink payoffs count
  await open("b");
  const cb = await cats();
  ok(cb.some(x => x === "Blink = 3 cards · 3 copies · 1 enabling · 2 rewarding"), `${label}: with Cloudshift in the deck, Blink is active and its payoffs count (${cb.join(" | ")})`);
  ok(!(await p.$$eval("#op-unknown .op-card", a => a.map(x => x.dataset.name))).includes("Kor Skyfisher"), `${label}: and Kor Skyfisher leaves No role identified`);
  // ---- nothing is saved
  await p.waitForTimeout(700);
  ok(await state() === s0, `${label}: the app's data, saved roles, your corrections, collection quantities, deck contents, local storage and the sync record are exactly as before`);
  ok(await p.evaluate(() => [...Object.values(S.coll), ...Object.values(S.decks).flatMap(d => Object.values(d.cards))].every(c => !("sy" in c) && !("synergy" in c))), `${label}: no synergy field on any saved card`);
  ok(await p.evaluate(() => JSON.stringify(S.roles)) === '{"Blood Moon":["Protection"]}', `${label}: your role fix is untouched`);
  // ---- layout
  await open("g");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll("#op-strat, #op-strat .op-card, #op-strat summary")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: the Strategies section fits the screen with everything open`);
  ok(await p.evaluate(() => [...document.querySelectorAll("#op-strat details > summary")].every(e => e.getBoundingClientRect().height >= 32)), `${label}: its headings are big enough to tap`);
  if (process.env.SHOTS) await (await p.$("#op-strat")).screenshot({ path: `/tmp/strat_${label}.png` });
  ok(!errs.length, `${label}: no page errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8907", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
