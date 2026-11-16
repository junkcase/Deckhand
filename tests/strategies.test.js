// Deck analysis → Strategies (synergy roles): what strategy or mechanic each card supports, read from its rules text.
// MOCKED: Scryfall and EDHREC are pretend (routes below), but the card texts are the real Oracle texts (see T below), mostly
// from EDHREC's Krenko, Mizzix and Shorikai average decks used in the audits.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// Rules text: Scryfall's Oracle text, copied from Scryfall's "Oracle cards" bulk data (a copy of it was read; Scryfall's API
// isn't reachable from where these tests were written). "Test Relic" is invented.
const T = {
  "Krenko, Mob Boss": ["Legendary Creature \u2014 Goblin Warrior", 4, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.", {"color_identity": ["R"]}],
  "Mizzix of the Izmagnus": ["Legendary Creature \u2014 Goblin Wizard", 4, "Whenever you cast an instant or sorcery spell with mana value greater than the number of experience counters you have, you get an experience counter.\nInstant and sorcery spells you cast cost {1} less to cast for each experience counter you have.", {"color_identity": ["R", "U"]}],
  "Goblin Chieftain": ["Creature \u2014 Goblin", 3, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nOther Goblin creatures you control get +1/+1 and have haste.", {"keywords": ["Haste"], "color_identity": ["R"]}],
  "Goblin King": ["Creature \u2014 Goblin", 3, "Other Goblins get +1/+1 and have mountainwalk.", {"color_identity": ["R"]}],
  "Goblin Warchief": ["Creature \u2014 Goblin Warrior", 3, "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.", {"color_identity": ["R"]}],
  "Goblin Matron": ["Creature \u2014 Goblin", 3, "When this creature enters, you may search your library for a Goblin card, reveal that card, put it into your hand, then shuffle.", {"color_identity": ["R"]}],
  "Goblin Piledriver": ["Creature \u2014 Goblin Warrior", 2, "Protection from blue (This creature can't be blocked, targeted, dealt damage, or enchanted by anything blue.)\nWhenever this creature attacks, it gets +2/+0 until end of turn for each other attacking Goblin.", {"keywords": ["Protection"], "color_identity": ["R"]}],
  "Krenko's Command": ["Sorcery", 2, "Create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Pashalik Mons": ["Legendary Creature \u2014 Goblin Warrior", 3, "Whenever Pashalik Mons or another Goblin you control dies, Pashalik Mons deals 1 damage to any target.\n{3}{R}, Sacrifice a Goblin: Create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Skirk Prospector": ["Creature \u2014 Goblin", 1, "Sacrifice a Goblin: Add {R}.", {"produced_mana": ["R"], "color_identity": ["R"]}],
  "Skullclamp": ["Artifact \u2014 Equipment", 1, "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}", {"keywords": ["Equip"], "color_identity": []}],
  "Goblin Grenade": ["Sorcery", 1, "As an additional cost to cast this spell, sacrifice a Goblin.\nGoblin Grenade deals 5 damage to any target.", {"color_identity": ["R"]}],
  "Impact Tremors": ["Enchantment", 2, "Whenever a creature you control enters, this enchantment deals 1 damage to each opponent.", {"color_identity": ["R"]}],
  "Blasphemous Act": ["Sorcery", 9, "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature.", {"color_identity": ["R"]}],
  "Kiki-Jiki, Mirror Breaker": ["Legendary Creature \u2014 Goblin Shaman", 5, "Haste\n{T}: Create a token that's a copy of target nonlegendary creature you control, except it has haste. Sacrifice it at the beginning of the next end step.", {"keywords": ["Haste"], "color_identity": ["R"]}],
  "Thornbite Staff": ["Kindred Artifact \u2014 Shaman Equipment", 2, "Equipped creature has \"{2}, {T}: This creature deals 1 damage to any target\" and \"Whenever a creature dies, untap this creature.\"\nWhenever a Shaman creature enters, you may attach this Equipment to it.\nEquip {4}", {"keywords": ["Equip"], "color_identity": []}],
  "Staff of Domination": ["Artifact", 3, "{1}: Untap this artifact.\n{2}, {T}: You gain 1 life.\n{3}, {T}: Untap target creature.\n{4}, {T}: Tap target creature.\n{5}, {T}: Draw a card.", {"color_identity": []}],
  "Faithless Looting": ["Sorcery", 1, "Draw two cards, then discard two cards.\nFlashback {2}{R} (You may cast this card from your graveyard for its flashback cost. Then exile it.)", {"keywords": ["Flashback"], "color_identity": ["R"]}],
  "Hazoret's Monument": ["Legendary Artifact", 3, "Red creature spells you cast cost {1} less to cast.\nWhenever you cast a creature spell, you may discard a card. If you do, draw a card.", {"color_identity": []}],
  "Blood Moon": ["Enchantment", 3, "Nonbasic lands are Mountains.", {"color_identity": ["R"]}],
  "Grenzo, Havoc Raiser": ["Legendary Creature \u2014 Goblin Rogue", 2, "Whenever a creature you control deals combat damage to a player, choose one —\n• Goad target creature that player controls.\n• Exile the top card of that player's library. Until end of turn, you may cast that card and you may spend mana as though it were mana of any color to cast that spell.", {"keywords": ["Goad"], "color_identity": ["R"]}],
  "Storm-Kiln Artist": ["Creature \u2014 Dwarf Shaman", 4, "This creature gets +1/+0 for each artifact you control.\nMagecraft — Whenever you cast or copy an instant or sorcery spell, create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure", "Magecraft"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
  "Harmonic Prodigy": ["Creature \u2014 Human Wizard", 2, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nIf a triggered ability of a Shaman or another Wizard you control triggers, that ability triggers an additional time.", {"keywords": ["Prowess"], "color_identity": ["R"]}],
  "Big Score": ["Instant", 4, "As an additional cost to cast this spell, discard a card.\nDraw two cards and create two Treasure tokens. (They're artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
  "Frantic Search": ["Instant", 3, "Draw two cards, then discard two cards. Untap up to three lands.", {"color_identity": ["U"]}],
  "Mystical Tutor": ["Instant", 1, "Search your library for an instant or sorcery card, reveal it, then shuffle and put that card on top.", {"color_identity": ["U"]}],
  "Reiterate": ["Instant", 3, "Buyback {3} (You may pay an additional {3} as you cast this spell. If you do, put this card into your hand as it resolves.)\nCopy target instant or sorcery spell. You may choose new targets for the copy.", {"keywords": ["Buyback"], "color_identity": ["R"]}],
  "Smothering Tithe": ["Enchantment", 4, "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["W"]}],
  "An Offer You Can't Refuse": ["Instant", 1, "Counter target noncreature spell. Its controller creates two Treasure tokens. (They're artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["U"]}],
  "Swan Song": ["Instant", 1, "Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.", {"color_identity": ["U"]}],
  "Generous Gift": ["Instant", 3, "Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.", {"color_identity": ["W"]}],
  "Swords to Plowshares": ["Instant", 1, "Exile target creature. Its controller gains life equal to its power.", {"color_identity": ["W"]}],
  "Path to Exile": ["Instant", 1, "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.", {"color_identity": ["W"]}],
  "Voltaic Key": ["Artifact", 1, "{1}, {T}: Untap target artifact.", {"color_identity": []}],
  "Unwinding Clock": ["Artifact", 4, "Untap all artifacts you control during each other player's untap step.", {"color_identity": []}],
  "Solemn Simulacrum": ["Artifact Creature \u2014 Golem", 4, "When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.", {"color_identity": []}],
  "Cosima, God of the Voyage": ["Legendary Creature \u2014 God // Legendary Artifact \u2014 Vehicle", 3, "At the beginning of your upkeep, you may exile Cosima. If you do, it gains \"Whenever a land you control enters, if Cosima is exiled, you may put a voyage counter on it. If you don't, return Cosima to the battlefield with X +1/+1 counters on it and draw X cards, where X is the number of voyage counters on it.\"\nWhenever a Vehicle you control deals combat damage to a player, that player exiles that many cards from the top of their library. You may play lands from among those cards for as long as they remain exiled.\nCrew 1", {"keywords": ["Crew"], "color_identity": ["U"]}],
  "Kotori, Pilot Prodigy": ["Legendary Creature \u2014 Moonfolk Pilot", 3, "Vehicles you control have crew 2.\nAt the beginning of combat on your turn, target artifact creature you control gains lifelink and vigilance until end of turn.", {"color_identity": ["U", "W"]}],
  "Prodigy's Prototype": ["Artifact \u2014 Vehicle", 3, "Whenever one or more Vehicles you control attack, create a 1/1 colorless Pilot creature token with \"This token crews Vehicles as though its power were 2 greater.\"\nCrew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)", {"keywords": ["Crew"], "color_identity": ["U", "W"]}],
  "Sting, the Glinting Dagger": ["Legendary Artifact \u2014 Equipment", 2, "Equipped creature gets +1/+1 and has haste.\nAt the beginning of each combat, untap equipped creature.\nEquipped creature has first strike as long as it's blocking or blocked by a Goblin or Orc.\nEquip {2}", {"keywords": ["Equip"], "color_identity": []}],
  "Lightning Greaves": ["Artifact \u2014 Equipment", 2, "Equipped creature has haste and shroud. (It can't be the target of spells or abilities.)\nEquip {0}", {"keywords": ["Equip"], "color_identity": []}],
  "Weatherlight": ["Legendary Artifact \u2014 Vehicle", 4, "Flying\nWhenever Weatherlight deals combat damage to a player, look at the top five cards of your library. You may reveal a historic card from among them and put it into your hand. Put the rest on the bottom of your library in a random order. (Artifacts, legendaries, and Sagas are historic.)\nCrew 3", {"keywords": ["Flying", "Crew"], "color_identity": []}],
  "Kor Skyfisher": ["Creature \u2014 Kor Soldier", 2, "Flying\nWhen this creature enters, return a permanent you control to its owner's hand.", {"keywords": ["Flying"], "color_identity": ["W"]}],
  "Cloudshift": ["Instant", 1, "Exile target creature you control, then return that card to the battlefield under your control.", {"color_identity": ["W"]}],
  "Zealous Conscripts": ["Creature \u2014 Human Warrior", 5, "Haste\nWhen this creature enters, gain control of target permanent until end of turn. Untap that permanent. It gains haste until end of turn.", {"keywords": ["Haste"], "color_identity": ["R"]}],
  "Elvish Archdruid": ["Creature \u2014 Elf Druid", 3, "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.", {"produced_mana": ["G"], "color_identity": ["G"]}],
  "Mountain": ["Basic Land \u2014 Mountain", 0, "({T}: Add {R}.)", {"produced_mana": ["R"], "color_identity": ["R"]}],
  "Ajani's Pridemate": ["Creature \u2014 Cat Soldier", 2, "Whenever you gain life, put a +1/+1 counter on this creature.", {"color_identity": ["W"]}],
  "Salvation Engine": ["Artifact \u2014 Vehicle", 5, "Other artifact creatures you control get +2/+2.\nWhenever this Vehicle attacks, return up to one target artifact card from your graveyard to the battlefield.\nCrew 6", {"keywords": ["Crew"], "color_identity": ["W"]}],
  "Swift Reconfiguration": ["Enchantment \u2014 Aura", 1, "Flash\nEnchant creature or Vehicle\nEnchanted permanent is a Vehicle artifact with crew 5 and it loses all other card types. (It's not a creature unless it's crewed.)", {"keywords": ["Enchant", "Flash"], "color_identity": ["W"]}],
  "Shorikai, Genesis Engine": ["Legendary Artifact \u2014 Vehicle", 4, "{1}, {T}: Draw two cards, then discard a card. Create a 1/1 colorless Pilot creature token with \"This token crews Vehicles as though its power were 2 greater.\"\nCrew 8 (Tap any number of creatures you control with total power 8 or more: This Vehicle becomes an artifact creature until end of turn.)", {"keywords": ["Crew"], "color_identity": ["U", "W"]}],
  "Coat of Arms": ["Artifact", 5, "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it. (For example, if two Goblin Warriors and a Goblin Shaman are on the battlefield, each gets +2/+2.)", {"color_identity": []}],
  "Mogg War Marshal": ["Creature \u2014 Goblin Warrior", 2, "Echo {1}{R} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\nWhen this creature enters or dies, create a 1/1 red Goblin creature token.", {"keywords": ["Echo"], "color_identity": ["R"]}],
  "Purphoros, God of the Forge": ["Legendary Enchantment Creature \u2014 God", 4, "Indestructible\nAs long as your devotion to red is less than five, Purphoros isn't a creature.\nWhenever another creature you control enters, Purphoros deals 2 damage to each opponent.\n{2}{R}: Creatures you control get +1/+0 until end of turn.", {"keywords": ["Indestructible"], "color_identity": ["R"]}],
  "Smuggler's Copter": ["Artifact \u2014 Vehicle", 2, "Flying\nWhenever this Vehicle attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)", {"keywords": ["Flying", "Crew"], "color_identity": []}],
  "Baral, Chief of Compliance": ["Legendary Creature \u2014 Human Wizard", 2, "Instant and sorcery spells you cast cost {1} less to cast.\nWhenever a spell or ability you control counters a spell, you may draw a card. If you do, discard a card.", {"color_identity": ["U"]}],
  "Sai, Master Thopterist": ["Legendary Creature \u2014 Human Artificer", 3, "Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.\n{1}{U}, Sacrifice two artifacts: Draw a card.", {"color_identity": ["U"]}],
  "Mechtitan Core": ["Artifact \u2014 Vehicle", 2, "{5}, Exile this Vehicle and four other artifact creatures and/or Vehicles you control: Create Mechtitan, a legendary 10/10 Construct artifact creature token with flying, vigilance, trample, lifelink, and haste that's all colors. When that token leaves the battlefield, return all cards exiled with this Vehicle except this card to the battlefield tapped under their owners' control.\nCrew 2", {"keywords": ["Crew"], "color_identity": []}],
  "Goblin Recruiter": ["Creature \u2014 Goblin", 2, "When this creature enters, search your library for any number of Goblin cards, reveal them, then shuffle and put those cards on top in any order.", {"color_identity": ["R"]}],
  "Test Relic": ["Artifact", 2, "{3}, {T}: You gain 2 life."],
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
  ok(await has("Faithless Looting", "graveyard/enabler/incidental") && await has("Faithless Looting", "graveyard/payoff/incidental") && await has("Hazoret's Monument", "graveyard/enabler/incidental"), `${label}: Faithless Looting's discard and own flashback are incidental, and so is Hazoret's Monument's discard (it comes with a draw)`);
  ok(await has("Goblin Grenade", "sacrifice/enabler/incidental", G) && await has("Frantic Search", "untap/enabler/incidental") && await has("Staff of Domination", "lifegain/enabler/incidental") && await has("Staff of Domination", "untap/enabler/direct"), `${label}: a one-shot sacrifice cost on a removal spell, untapping lands on a draw spell, 1 life on an activated ability: incidental`);
  // ---- opponents' tokens and life
  for (const n of ["Swan Song", "Generous Gift"]) ok(await none(n, "tokens"), `${label}: ${n} gives the opponent a token: not a token card`);
  ok(await none("An Offer You Can't Refuse", "artifacts"), `${label}: An Offer You Can't Refuse gives the opponent Treasure: not an artifact card`);
  ok(await none("Swords to Plowshares", "lifegain") && await none("Path to Exile", "landfall"), `${label}: life or a land for the opponent is not lifegain or landfall`);
  // ---- not synergy
  ok(await none("Blasphemous Act", "gowide") && await none("Lightning Greaves", "voltron") && await none("Blood Moon", "") && (await sy("Grenzo, Havoc Raiser", G)).length === 0, `${label}: Blasphemous Act (a cost that counts creatures), Lightning Greaves (protection), Blood Moon, Grenzo: no strategy`);
  ok(await none("Krenko, Mob Boss", "blink", G) && !(await sy("Goblin Matron", G)).some(x => x.startsWith("type:Goblin/enabler")), `${label}: a card's own name isn't read as a creature type (Goblin Matron doesn't "make Goblins")`);
  // ---- creature types: only those in the deck, each on its own
  ok(await has("Harmonic Prodigy", "type:Wizard/payoff/direct", G) && await none("Elvish Archdruid", "type:Elf", G) && await has("Elvish Archdruid", "type:Elf/payoff/direct", ["elf"]), `${label}: an Elf lord rewards Elves only in a deck with Elves`);
  // regression: Harmonic Prodigy's "a Shaman or another Wizard you control" rewards both types, each on its own
  ok(await has("Harmonic Prodigy", "type:Shaman/payoff/direct", G) && await has("Harmonic Prodigy", "type:Wizard/payoff/direct", G), `${label}: Harmonic Prodigy rewards Shamans and Wizards (${await sy("Harmonic Prodigy", G)})`);
  ok(await has("Harmonic Prodigy", "type:Shaman/payoff/direct", ["shaman"]) && await none("Harmonic Prodigy", "type:Wizard", ["shaman"]) && await has("Harmonic Prodigy", "type:Wizard/payoff/direct", ["wizard"]) && await none("Harmonic Prodigy", "type:Shaman", ["wizard"]), `${label}: each type is recognised independently: only the types this deck's creatures have`);
  ok(await p.evaluate(() => SYQ("Harmonic Prodigy", ["shaman", "wizard"]).find(e => e.cat === "type:Shaman").quote) === "If a triggered ability of a Shaman or another Wizard you control triggers", `${label}: and quotes the whole clause that matched`);
  ok(await has("Thornbite Staff", "type:Shaman/payoff/direct", G) && await none("Thornbite Staff", "type:Shaman", ["goblin"]), `${label}: Shaman synergy only when the deck has Shamans`);

  // ---- corrections from the real-text audit (real Oracle text)
  const Q = (n, cat, types) => p.evaluate(([n, c, t]) => (SYQ(n, t).find(e => e.cat === c) || {}).quote || "", [n, cat, types || []]);
  ok(await none("Goblin Chieftain", "gowide", G) && await has("Goblin Chieftain", "type:Goblin/payoff/direct", G), `${label}: a Goblin lord ("Other Goblin creatures you control get +1/+1") is a Goblin card, not Go-wide`);
  ok(await none("Salvation Engine", "gowide") && await has("Salvation Engine", "artifacts/payoff/direct") && await has("Purphoros, God of the Forge", "gowide/payoff/direct"), `${label}: nor is an artifact lord (Salvation Engine); an anthem for all creatures (Purphoros) still is`);
  for (const n of ["Hazoret's Monument", "Shorikai, Genesis Engine", "Baral, Chief of Compliance", "Smuggler's Copter"]) ok(await has(n, "graveyard/enabler/incidental") && !(await has(n, "graveyard/enabler/direct")), `${label}: ${n}: discarding as part of drawing is incidental`);
  ok(/Discards as part of drawing/.test(await p.evaluate(() => SYQ("Shorikai, Genesis Engine").find(e => e.cat === "graveyard").why)), `${label}: and says so`);
  ok(await has("Shorikai, Genesis Engine", "artifacts/enabler/direct") && await Q("Shorikai, Genesis Engine", "artifacts") === "This token crews Vehicles as though its power were 2 greater", `${label}: Shorikai's Pilots crew Vehicles: artifact (Vehicle) support, quoting the token's ability`);
  ok(await has("Swift Reconfiguration", "artifacts/enabler/direct") && await has("Weatherlight", "artifacts/payoff/direct") && /historic/.test(await p.evaluate(() => SYQ("Weatherlight").find(e => e.cat === "artifacts").why)), `${label}: Swift Reconfiguration (makes a Vehicle) and Weatherlight (historic cards) are recognised`);
  ok(await has("Kotori, Pilot Prodigy", "lifegain/enabler/incidental") || (await sy("Kotori, Pilot Prodigy")).some(x => x.startsWith("lifegain/enabler")), `${label}: Kotori's granted lifelink is found (and marked as given, see the deck check below)`);
  ok(await p.evaluate(() => ctypesOf({ type: "Kindred Artifact — Shaman Equipment" }).join()) === "Shaman" && await p.evaluate(() => ctypesOf({ type: "Kindred Enchantment — Goblin Aura" }).join()) === "Goblin", `${label}: a Kindred card's Equipment or Aura subtype isn't a creature type`);
  ok(await has("Mogg War Marshal", "sacrifice/fodder/direct/potential", G) && await has("Solemn Simulacrum", "sacrifice/fodder/direct/potential"), `${label}: creatures that do something when they die are sacrifice fodder (counted only with a way to sacrifice)`);
  ok(await p.evaluate(() => { const c = CARD("Coat of Arms"); return optSynergy({ text: c.oracle_text, type: c.type_line, kw: [] }, slim(c), ["goblin"], "goblin").map(e => e.cat + "/" + e.side).sort().join(); }) === "gowide/payoff,type:Goblin/payoff", `${label}: Coat of Arms rewards the deck's main creature type, and going wide`);
  ok(await Q("Thornbite Staff", "sacrifice", G) === "Whenever a creature dies" && await Q("Goblin Recruiter", "type:Goblin", G) === "search your library for any number of Goblin cards", `${label}: quotes are whole clauses, never cut mid-word`);
  ok(await p.evaluate(() => ["Krenko, Mob Boss", "Mizzix of the Izmagnus", "Shorikai, Genesis Engine", "Harmonic Prodigy", "Storm-Kiln Artist", "Sai, Master Thopterist", "Mechtitan Core", "Kiki-Jiki, Mirror Breaker"].every(n => SYQ(n, ["goblin", "wizard", "shaman", "pilot", "construct"]).every(e => e.quote && !/^\s|\s$/.test(e.quote) && e.quote === e.quote.replace(/["“”]/g, "")))), `${label}: no quote has stray quote marks or spaces`);

  // deck-level: granted lifelink counts only with a lifegain payoff; fodder only with a way to sacrifice; the commander line
  const dk = await p.evaluate(() => {
    const run = names => { const d = { id: "", name: "t", format: "commander", cmdr: [], cards: {}, themes: ["Vehicles"], created: 1, updated: 1 }; addToDeck(d, CARD("Shorikai, Genesis Engine"), 1, false, true); d.cmdr = Object.keys(d.cards);
      for (const n of names) addToDeck(d, CARD(n), 1, false, true);
      const A = optAnalyze(d, { cmd: "", theme: "", R: null, stat: new Map(), tstat: new Map() }, { combos: null }), act = (n, c) => A.rows.find(r => r.name === n).sy.filter(e => e.cat === c && e.active).length > 0;
      return { kotori: act("Kotori, Pilot Prodigy", "lifegain"), solemn: act("Solemn Simulacrum", "sacrifice"), cmd: [...new Set(A.strat.cmd.map(x => x.e.cat))].join(), single: A.strat.cats.filter(g => g.cards.length === 1).map(g => g.key).join() }; };
    return { plain: run(["Kotori, Pilot Prodigy", "Solemn Simulacrum", "Swift Reconfiguration", "Weatherlight"]), more: run(["Kotori, Pilot Prodigy", "Solemn Simulacrum", "Ajani's Pridemate", "Sai, Master Thopterist"]) };
  });
  ok(!dk.plain.kotori && dk.more.kotori, `${label}: Kotori's lifelink counts for Lifegain only in a deck with a lifegain payoff (Ajani's Pridemate)`);
  ok(!dk.plain.solemn && dk.more.solemn, `${label}: Solemn Simulacrum counts as sacrifice fodder only in a deck with a way to sacrifice (Sai)`);
  ok(dk.plain.cmd === "tokens,artifacts", `${label}: Shorikai supports Tokens and Artifacts (its Pilots crew Vehicles), not Graveyard (${dk.plain.cmd})`);

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
  ok(/Lord: makes your Goblins stronger · “Other Goblin creatures you control get \+1/.test(gob) && /Rewards playing Goblins · “it gets \+2\/\+0 until end of turn for each other attacking Goblin”/.test(gob), `${label}: each card says why, quoting its text`);
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
  ok(await p.$$eval("#opStratSingle .op-strat .label", a => a.map(x => x.textContent.trim())).then(l => l.includes("Copy effects")) && /^\d+ strateg(y|ies) · \d+ with one card$/.test(await txt("#op-strat > summary .num")), `${label}: strategies with a single card are listed apart, under "One card each", and the heading counts them apart`);
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
