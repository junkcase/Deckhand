// Deck analysis → Strategies → Enablers and payoffs (step 2): "Worth a look" when one side of a strategy is missing or rests on one card.
// MOCKED: Scryfall and EDHREC are pretend (routes below), but every card text is the real Oracle text, copied from Scryfall's
// "Oracle cards" bulk data (a copy of it was read; Scryfall's API isn't reachable from where these tests were written).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const T = {
  "Krenko, Mob Boss": ["Legendary Creature \u2014 Goblin Warrior", 4, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.", {"color_identity": ["R"]}],
  "Talrand, Sky Summoner": ["Legendary Creature \u2014 Merfolk Wizard", 4, "Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.", {"color_identity": ["U"]}],
  "Intangible Virtue": ["Enchantment", 2, "Creature tokens you control get +1/+1 and have vigilance.", {"color_identity": ["W"]}],
  "Twilight Drover": ["Creature \u2014 Spirit", 3, "Whenever a creature token leaves the battlefield, put a +1/+1 counter on this creature.\n{2}{W}, Remove a +1/+1 counter from this creature: Create two 1/1 white Spirit creature tokens with flying.", {"color_identity": ["W"]}],
  "Krenko's Command": ["Sorcery", 2, "Create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Dragon Fodder": ["Sorcery", 2, "Create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Beetleback Chief": ["Creature \u2014 Goblin Warrior", 4, "When this creature enters, create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Swan Song": ["Instant", 1, "Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.", {"color_identity": ["U"]}],
  "Generous Gift": ["Instant", 3, "Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.", {"color_identity": ["W"]}],
  "Skullclamp": ["Artifact \u2014 Equipment", 1, "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}", {"keywords": ["Equip"], "color_identity": []}],
  "Blood Artist": ["Creature \u2014 Vampire", 2, "Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.", {"color_identity": ["B"]}],
  "Zulaport Cutthroat": ["Creature \u2014 Human Rogue Ally", 2, "Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life.", {"color_identity": ["B"]}],
  "Pashalik Mons": ["Legendary Creature \u2014 Goblin Warrior", 3, "Whenever Pashalik Mons or another Goblin you control dies, Pashalik Mons deals 1 damage to any target.\n{3}{R}, Sacrifice a Goblin: Create two 1/1 red Goblin creature tokens.", {"color_identity": ["R"]}],
  "Viscera Seer": ["Creature \u2014 Vampire Wizard", 1, "Sacrifice a creature: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)", {"keywords": ["Scry"], "color_identity": ["B"]}],
  "Goblin Bombardment": ["Enchantment", 2, "Sacrifice a creature: This enchantment deals 1 damage to any target.", {"color_identity": ["R"]}],
  "Mogg War Marshal": ["Creature \u2014 Goblin Warrior", 2, "Echo {1}{R} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\nWhen this creature enters or dies, create a 1/1 red Goblin creature token.", {"keywords": ["Echo"], "color_identity": ["R"]}],
  "Solemn Simulacrum": ["Artifact Creature \u2014 Golem", 4, "When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.", {"color_identity": []}],
  "Cloudshift": ["Instant", 1, "Exile target creature you control, then return that card to the battlefield under your control.", {"color_identity": ["W"]}],
  "Ephemerate": ["Instant", 1, "Exile target creature you control, then return it to the battlefield under its owner's control.\nRebound (If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, you may cast this card from exile without paying its mana cost.)", {"keywords": ["Rebound"], "color_identity": ["W"]}],
  "Kor Skyfisher": ["Creature \u2014 Kor Soldier", 2, "Flying\nWhen this creature enters, return a permanent you control to its owner's hand.", {"keywords": ["Flying"], "color_identity": ["W"]}],
  "Guttersnipe": ["Creature \u2014 Goblin Shaman", 3, "Whenever you cast an instant or sorcery spell, this creature deals 2 damage to each opponent.", {"color_identity": ["R"]}],
  "Archmage Emeritus": ["Creature \u2014 Human Wizard", 4, "Magecraft — Whenever you cast or copy an instant or sorcery spell, draw a card.", {"keywords": ["Magecraft"], "color_identity": ["U"]}],
  "Lightning Bolt": ["Instant", 1, "Lightning Bolt deals 3 damage to any target.", {"color_identity": ["R"]}],
  "Counterspell": ["Instant", 2, "Counter target spell.", {"color_identity": ["U"]}],
  "Padeem, Consul of Innovation": ["Legendary Creature \u2014 Vedalken Artificer", 4, "Artifacts you control have hexproof. (They can't be the targets of spells or abilities your opponents control.)\nAt the beginning of your upkeep, if you control the artifact with the greatest mana value or tied for the greatest mana value, draw a card.", {"color_identity": ["U"]}],
  "Thoughtcast": ["Sorcery", 5, "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nDraw two cards.", {"keywords": ["Affinity"], "color_identity": ["U"]}],
  "Dispatch": ["Instant", 1, "Tap target creature.\nMetalcraft — If you control three or more artifacts, exile that creature.", {"keywords": ["Metalcraft"], "color_identity": ["W"]}],
  "Sol Ring": ["Artifact", 1, "{T}: Add {C}{C}.", {"produced_mana": ["C"], "color_identity": []}],
  "Arcane Signet": ["Artifact", 2, "{T}: Add one mana of any color in your commander's color identity.", {"produced_mana": ["B", "G", "R", "U", "W"], "color_identity": []}],
  "Smothering Tithe": ["Enchantment", 4, "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["W"]}],
  "Goldspan Dragon": ["Creature \u2014 Dragon", 5, "Flying, haste\nWhenever this creature attacks or becomes the target of a spell, create a Treasure token.\nTreasures you control have \"{T}, Sacrifice this artifact: Add two mana of any one color.\"", {"keywords": ["Flying", "Treasure", "Haste"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
  "Big Score": ["Instant", 4, "As an additional cost to cast this spell, discard a card.\nDraw two cards and create two Treasure tokens. (They're artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
  "An Offer You Can't Refuse": ["Instant", 1, "Counter target noncreature spell. Its controller creates two Treasure tokens. (They're artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["U"]}],
  "Fathom Mage": ["Creature \u2014 Human Wizard", 4, "Evolve (Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)\nWhenever a +1/+1 counter is put on this creature, you may draw a card.", {"keywords": ["Evolve"], "color_identity": ["G", "U"]}],
  "Bred for the Hunt": ["Enchantment", 3, "Whenever a creature you control with a +1/+1 counter on it deals combat damage to a player, you may draw a card.", {"color_identity": ["G", "U"]}],
  "Herald of Secret Streams": ["Creature \u2014 Merfolk Warrior", 4, "Creatures you control with +1/+1 counters on them can't be blocked.", {"color_identity": ["U"]}],
  "Flux Channeler": ["Creature \u2014 Human Wizard", 3, "Whenever you cast a noncreature spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)", {"keywords": ["Proliferate"], "color_identity": ["U"]}],
  "Travel Preparations": ["Sorcery", 2, "Put a +1/+1 counter on each of up to two target creatures.\nFlashback {1}{W} (You may cast this card from your graveyard for its flashback cost. Then exile it.)", {"keywords": ["Flashback"], "color_identity": ["G", "W"]}],
  "Katsumasa, the Animator": ["Legendary Creature \u2014 Moonfolk Artificer", 4, "Flying\n{2}{U}: Until end of turn, target noncreature artifact you control becomes an artifact creature and gains flying. If it's not a Vehicle, it has base power and toughness 1/1 until end of turn.\nAt the beginning of your upkeep, put a +1/+1 counter on each of up to three target noncreature artifacts.", {"keywords": ["Flying"], "color_identity": ["U"]}],
  "Lotus Cobra": ["Creature \u2014 Snake", 2, "Landfall — Whenever a land you control enters, add one mana of any color.", {"keywords": ["Landfall"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["G"]}],
  "Steppe Lynx": ["Creature \u2014 Cat", 1, "Landfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.", {"keywords": ["Landfall"], "color_identity": ["W"]}],
  "Azusa, Lost but Seeking": ["Legendary Creature \u2014 Human Monk", 3, "You may play two additional lands on each of your turns.", {"color_identity": ["G"]}],
  "Ajani's Pridemate": ["Creature \u2014 Cat Soldier", 2, "Whenever you gain life, put a +1/+1 counter on this creature.", {"color_identity": ["W"]}],
  "Bloodbond Vampire": ["Creature \u2014 Vampire Shaman Ally", 4, "Whenever you gain life, put a +1/+1 counter on this creature.", {"color_identity": ["B"]}],
  "Staff of Domination": ["Artifact", 3, "{1}: Untap this artifact.\n{2}, {T}: You gain 1 life.\n{3}, {T}: Untap target creature.\n{4}, {T}: Tap target creature.\n{5}, {T}: Draw a card.", {"color_identity": []}],
  "Swords to Plowshares": ["Instant", 1, "Exile target creature. Its controller gains life equal to its power.", {"color_identity": ["W"]}],
  "Soul Warden": ["Creature \u2014 Human Cleric", 1, "Whenever another creature enters, you gain 1 life.", {"color_identity": ["W"]}],
  "Mountain": ["Basic Land \u2014 Mountain", 0, "({T}: Add {R}.)", {"produced_mana": ["R"], "color_identity": ["R"]}],
  "Grenzo, Havoc Raiser": ["Legendary Creature \u2014 Goblin Rogue", 2, "Whenever a creature you control deals combat damage to a player, choose one —\n• Goad target creature that player controls.\n• Exile the top card of that player's library. Until end of turn, you may cast that card and you may spend mana as though it were mana of any color to cast that spell.", {"keywords": ["Goad"], "color_identity": ["R"]}],
  "Coat of Arms": ["Artifact", 5, "Each creature gets +1/+1 for each other creature on the battlefield that shares at least one creature type with it. (For example, if two Goblin Warriors and a Goblin Shaman are on the battlefield, each gets +2/+2.)", {"color_identity": []}],
  "Mirkwood Bats": ["Creature \u2014 Bat", 4, "Flying\nWhenever you create or sacrifice a token, each opponent loses 1 life.", {"keywords": ["Flying"], "color_identity": ["B"]}],
  "Rhys the Redeemed": ["Legendary Creature \u2014 Elf Warrior", 1, "{2}{G/W}, {T}: Create a 1/1 green and white Elf Warrior creature token.\n{4}{G/W}{G/W}, {T}: For each creature token you control, create a token that's a copy of that creature.", {"color_identity": ["G", "W"]}],
  "Cruel Celebrant": ["Creature \u2014 Vampire", 2, "Whenever this creature or another creature or planeswalker you control dies, each opponent loses 1 life and you gain 1 life.", {"color_identity": ["B", "W"]}],
  "Grim Haruspex": ["Creature \u2014 Human Wizard", 3, "Morph {B} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)\nWhenever another nontoken creature you control dies, draw a card.", {"keywords": ["Morph"], "color_identity": ["B"]}],
  "Massacre Wurm": ["Creature \u2014 Phyrexian Wurm", 6, "When this creature enters, creatures your opponents control get -2/-2 until end of turn.\nWhenever a creature an opponent controls dies, that player loses 2 life.", {"color_identity": ["B"]}],
  "Gray Merchant of Asphodel": ["Creature \u2014 Zombie", 5, "When this creature enters, each opponent loses X life, where X is your devotion to black. You gain life equal to the life lost this way. (Each {B} in the mana costs of permanents you control counts toward your devotion to black.)", {"color_identity": ["B"]}],
  "Fiery Justice": ["Sorcery", 3, "Fiery Justice deals 5 damage divided as you choose among any number of targets. Target opponent gains 5 life.", {"color_identity": ["G", "R", "W"]}],
  "Krenko, Tin Street Kingpin": ["Legendary Creature \u2014 Goblin", 3, "Whenever Krenko attacks, put a +1/+1 counter on it, then create a number of 1/1 red Goblin creature tokens equal to Krenko's power.", {"color_identity": ["R"]}],
  "Cosima, God of the Voyage": ["Legendary Creature \u2014 God // Legendary Artifact \u2014 Vehicle", 3, "At the beginning of your upkeep, you may exile Cosima. If you do, it gains \"Whenever a land you control enters, if Cosima is exiled, you may put a voyage counter on it. If you don't, return Cosima to the battlefield with X +1/+1 counters on it and draw X cards, where X is the number of voyage counters on it.\"\nWhenever a Vehicle you control deals combat damage to a player, that player exiles that many cards from the top of their library. You may play lands from among those cards for as long as they remain exiled.\nCrew 1", {"keywords": ["Crew"], "color_identity": ["U"]}],
  "Anointed Procession": ["Enchantment", 4, "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.", {"color_identity": ["W"]}],
  "Divine Visitation": ["Enchantment", 5, "If one or more creature tokens would be created under your control, that many 4/4 white Angel creature tokens with flying and vigilance are created instead.", {"color_identity": ["W"]}],
  "Chatterfang, Squirrel General": ["Legendary Creature \u2014 Squirrel Warrior", 3, "Forestwalk (This creature can't be blocked as long as defending player controls a Forest.)\nIf one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead.\n{B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn.", {"keywords": ["Landwalk", "Forestwalk"], "color_identity": ["B", "G"]}],
  "Peregrin Took": ["Legendary Creature \u2014 Halfling Citizen", 3, "If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\nSacrifice three Foods: Draw a card.", {"keywords": ["Food"], "color_identity": ["G"]}],
  "Idol of Oblivion": ["Artifact", 2, "{T}: Draw a card. Activate only if you created a token this turn.\n{8}, {T}, Sacrifice this artifact: Create a 10/10 colorless Eldrazi creature token.", {"color_identity": []}],
  "Forbidden Orchard": ["Land", 0, "{T}: Add one mana of any color.\nWhenever you tap this land for mana, target opponent creates a 1/1 colorless Spirit creature token.", {"produced_mana": ["B", "G", "R", "U", "W"], "color_identity": []}],
  "Ral, Crackling Wit": ["Legendary Planeswalker \u2014 Ral", 4, "Whenever you cast a noncreature spell, put a loyalty counter on Ral.\n+1: Create a 1/1 blue and red Otter creature token with prowess.\n−3: Draw three cards, then discard two cards.\n−10: Draw three cards. You get an emblem with \"Instant and sorcery spells you cast have storm.\" (Whenever you cast an instant or sorcery spell, copy it for each spell cast before it this turn.)", {"color_identity": ["R", "U"]}],
  "Rundvelt Hordemaster": ["Creature \u2014 Goblin Warrior", 2, "Other Goblins you control get +1/+1.\nWhenever this creature or another Goblin you control dies, exile the top card of your library. If it's a Goblin creature card, you may cast that card until the end of your next turn.", {"color_identity": ["R"]}],
  "Kokusho, the Evening Star": ["Legendary Creature \u2014 Dragon Spirit", 6, "Flying\nWhen Kokusho dies, each opponent loses 5 life. You gain life equal to the life lost this way.", {"keywords": ["Flying"], "color_identity": ["B"]}],
  "Vindictive Lich": ["Creature \u2014 Zombie Wizard", 4, "When this creature dies, choose one or more. Each mode must target a different player.\n• Target opponent sacrifices a creature of their choice.\n• Target opponent discards two cards.\n• Target opponent loses 5 life.", {"color_identity": ["B"]}],
  "Tergrid, God of Fright // Tergrid's Lantern": ["Legendary Creature \u2014 God // Legendary Artifact", 5, "Menace\nWhenever an opponent sacrifices a nontoken permanent or discards a permanent card, you may put that card from a graveyard onto the battlefield under your control.\n{T}: Target player loses 3 life unless they sacrifice a nonland permanent of their choice or discard a card.\n{3}{B}: Untap Tergrid's Lantern.", {"keywords": ["Menace"], "color_identity": ["B"]}],
  "Hardened Scales": ["Enchantment", 1, "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.", {"color_identity": ["G"]}],
  "Walking Ballista": ["Artifact Creature \u2014 Construct", 0, "This creature enters with X +1/+1 counters on it.\n{4}: Put a +1/+1 counter on this creature.\nRemove a +1/+1 counter from this creature: It deals 1 damage to any target.", {"color_identity": []}],
  "Exquisite Blood": ["Enchantment", 5, "Whenever an opponent loses life, you gain that much life.", {"color_identity": ["B"]}],
  "Sanguine Bond": ["Enchantment", 5, "Whenever you gain life, target opponent loses that much life.", {"color_identity": ["B"]}],
  "Dockside Extortionist": ["Creature \u2014 Goblin Pirate", 2, "When this creature enters, create X Treasure tokens, where X is the number of artifacts and enchantments your opponents control. (Treasure tokens are artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
  "Pitiless Plunderer": ["Creature \u2014 Human Pirate", 4, "Whenever another creature you control dies, create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["B"]}],
  "Gilded Goose": ["Creature \u2014 Bird", 1, "Flying\nWhen this creature enters, create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\n{1}{G}, {T}: Create a Food token.\n{T}, Sacrifice a Food: Add one mana of any color.", {"keywords": ["Flying", "Food"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["G"]}],
  "Savvy Hunter": ["Creature \u2014 Human Warrior", 3, "Whenever this creature attacks or blocks, create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\nSacrifice two Foods: Draw a card.", {"keywords": ["Food"], "color_identity": ["B", "G"]}],
  "Whirler Rogue": ["Creature \u2014 Human Rogue Artificer", 4, "When this creature enters, create two 1/1 colorless Thopter artifact creature tokens with flying.\nTap two untapped artifacts you control: Target creature can't be blocked this turn.", {"color_identity": ["U"]}],
  "Tireless Provisioner": ["Creature \u2014 Elf Scout", 3, "Landfall — Whenever a land you control enters, create a Food token or a Treasure token. (Food is an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\" Treasure is an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure", "Food", "Landfall"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["G"]}],
  "Tireless Tracker": ["Creature \u2014 Human Scout", 3, "Landfall — Whenever a land you control enters, investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")\nWhenever you sacrifice a Clue, put a +1/+1 counter on this creature.", {"keywords": ["Investigate", "Landfall"], "color_identity": ["G"]}],
  "Storm-Kiln Artist": ["Creature \u2014 Dwarf Shaman", 4, "This creature gets +1/+0 for each artifact you control.\nMagecraft — Whenever you cast or copy an instant or sorcery spell, create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")", {"keywords": ["Treasure", "Magecraft"], "produced_mana": ["B", "G", "R", "U", "W"], "color_identity": ["R"]}],
};
const card = n => { const [type, cmc, text, x] = T[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: text, keywords: [] }, x || {}); };
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://raw.githubusercontent.com/**", r => r.fulfill({ status: 404, body: "" }));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }));
  await p.route("https://json.edhrec.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => Object.keys(T).find(n => n === i.name || card(n).id === i.id)).filter(Boolean).map(card), not_found: [] }); }
    return J({ data: [] }); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec|githubusercontent/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8908/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(TT => { window.CARD = n => { const [type, cmc, text, x] = TT[n]; return Object.assign({ object: "card", id: "id-" + n.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: "", colors: [], prices: {}, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "", normal: "" }, oracle_text: text, keywords: [] }, x || {}); };
    for (const n of Object.keys(TT)) { const c = CARD(n); OPT.text.set(n, { text: c.oracle_text, type: c.type_line, kw: c.keywords || [], mana: c.produced_mana || [] }); }
    // the imbalance observations for a deck: [commander, theme, [[name, copies]…]]
    window.IMB = (cmd, theme, list) => { const d = { id: "", name: "t", format: "commander", cmdr: [], cards: {}, themes: theme ? [theme] : [], created: 1, updated: 1 }; addToDeck(d, CARD(cmd), 1, false, true); d.cmdr = Object.keys(d.cards);
      for (const x of list) { const [n, q] = Array.isArray(x) ? x : [x, 1]; addToDeck(d, CARD(n), q, false, true); }
      return optAnalyze(d, { cmd: "", theme: "", R: null, stat: new Map(), tstat: new Map() }, { combos: null }).strat.imb.map(o => ({ key: o.key, text: o.text, sides: o.sides.map(s => ({ name: s.name, n: s.n, copies: s.copies, cmd: s.cmd, cards: s.l.map(y => y.r.name) })) })); }; }, T);
  const imb = (cmd, theme, list) => p.evaluate(([c, t, l]) => IMB(c, t, l), [cmd, theme, list]);
  const keys = async (...a) => (await imb(...a)).map(o => o.key).join();
  const C = "Grenzo, Havoc Raiser";          // a commander with no strategy of its own
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());

  // ---- tokens
  let o = await imb(C, "", ["Intangible Virtue", "Mirkwood Bats", "Swan Song", "Generous Gift"]);
  ok(o.length === 1 && o[0].key === "tokens" && o[0].sides[0].n === 2 && o[0].sides[1].n === 0, `${label}: two token payoffs and no token maker (the opponent's tokens from Swan Song and Generous Gift don't count): worth a look`);
  ok(/^This deck has 2 cards that reward tokens or make more of them, but no card that makes creature tokens\./.test(o[0].text), `${label}: the explanation gives the deck's own counts (${o[0].text.slice(0, 80)})`);
  ok(await keys(C, "", ["Intangible Virtue", "Mirkwood Bats", "Krenko's Command"]) === "", `${label}: add one token maker and both sides are there: nothing to say`);
  o = await imb(C, "", ["Intangible Virtue", "Mirkwood Bats", ["Rhys the Redeemed", 1], "Coat of Arms"]);
  ok(o.map(x => x.key).join() === "tokens" && o[0].sides[0].n === 3 && o[0].sides[1].n === 1 && o[0].sides[0].cards.includes("Rhys the Redeemed") && o[0].sides[1].cards.join() === "Rhys the Redeemed" && /only one card that makes them \(Rhys the Redeemed\)/.test(o[0].text), `${label}: Rhys the Redeemed makes and rewards tokens: counted once on each side; three payoffs resting on one maker is worth a look, naming it`);
  ok(await keys(C, "", ["Intangible Virtue", "Rhys the Redeemed"]) === "", `${label}: Rhys plus one payoff: nothing to say`);
  o = await imb("Krenko, Mob Boss", "", ["Intangible Virtue", "Mirkwood Bats", "Rhys the Redeemed"].concat([]));
  ok(o.length === 0, `${label}: the commander counts as support: Krenko makes tokens for them`);
  o = await imb("Krenko, Mob Boss", "", [["Intangible Virtue", 1], "Mirkwood Bats", "Coat of Arms"].filter(x => x !== "Coat of Arms"));
  ok(o.length === 0, `${label}: two payoffs with the commander as their maker: nothing to say (one maker is enough when the payoffs are only two)`);
  ok(await keys(C, "", ["Krenko's Command", "Dragon Fodder", "Beetleback Chief", "Lightning Bolt"]) === "", `${label}: token makers with nothing that rewards tokens: no observation (tokens are often side value of another plan)`);
  ok(await keys(C, "", ["Talrand, Sky Summoner", "Ral, Crackling Wit", "Guttersnipe", "Lightning Bolt", "Counterspell"]) === "", `${label}: Talrand and Ral making tokens in a spells deck: no observation (the Mizzix case)`);
  o = await imb(C, "", ["Anointed Procession", "Divine Visitation", "Lightning Bolt"]);
  ok(o.map(x => x.key).join() === "tokens" && o[0].sides[0].name === "Token payoffs and amplifiers" && o[0].sides[0].n === 2 && o[0].sides[1].n === 0 && /reward tokens or make more of them, but no card that makes creature tokens/.test(o[0].text), `${label}: two token amplifiers (Anointed Procession, Divine Visitation) and no token maker: worth a look`);
  ok(await keys(C, "", ["Anointed Procession", "Divine Visitation", "Krenko's Command"]) === "", `${label}: add a maker: nothing to say`);
  ok(await keys(C, "", ["Twilight Drover", "Intangible Virtue"]) === "", `${label}: Twilight Drover makes tokens and rewards them leaving: with Intangible Virtue, both sides are there`);
  ok(await keys(C, "", ["Swan Song", "Generous Gift", "Forbidden Orchard", "Intangible Virtue", "Idol of Oblivion"]) === "", `${label}: Idol of Oblivion makes a token itself; the opponents' tokens don't count either way`);
  ok(await keys(C, "", ["Krenko's Command"]) === "" && await keys(C, "", ["Intangible Virtue"]) === "", `${label}: a single card is not a strategy: nothing to say`);
  // ---- sacrifice
  o = await imb(C, "", ["Skullclamp", "Pashalik Mons", ["Mogg War Marshal", 2]]);
  ok(o.length === 0, `${label}: Pashalik Mons is both an outlet and a payoff; with Skullclamp that is 2 payoffs and 1 outlet: nothing to say`);
  o = await imb(C, "", ["Skullclamp", "Mogg War Marshal", "Solemn Simulacrum"]);
  ok(o.map(x => x.key).join() === "sacrifice-fodder" && o[0].sides[0].n === 2 && /2 creatures that do something when they die, but no way to sacrifice them/.test(o[0].text), `${label}: two creatures that do something when they die, and no way to sacrifice them: worth a look (Skullclamp alone is 1 payoff: not enough to say more)`);
  ok(await keys(C, "", ["Skullclamp", "Mogg War Marshal", "Solemn Simulacrum", "Viscera Seer"]) === "", `${label}: add a way to sacrifice: nothing to say`);
  o = await imb(C, "", ["Viscera Seer", "Goblin Bombardment", "Lightning Bolt"]);
  ok(o.map(x => x.key).join() === "sacrifice-outlets" && o[0].sides[0].n === 2 && o[0].sides[1].n === 0, `${label}: two ways to sacrifice and nothing to sacrifice usefully: worth a look`);
  ok(await keys(C, "", ["Viscera Seer", "Goblin Bombardment", "Mogg War Marshal"]) === "" && await keys(C, "", ["Viscera Seer", "Goblin Bombardment", "Dragon Fodder"]) === "", `${label}: fodder (Mogg War Marshal) or a token maker resolves it`);
  // death triggers in the current wording are sacrifice payoffs
  o = await imb(C, "", ["Blood Artist", "Zulaport Cutthroat", "Cruel Celebrant"]);
  ok(o.map(x => x.key).join() === "sacrifice" && o[0].sides[0].n === 3 && o[0].sides[0].cards.join() === "Blood Artist,Cruel Celebrant,Zulaport Cutthroat" && /3 cards that reward creatures dying, but no way to sacrifice them/.test(o[0].text), `${label}: Blood Artist, Zulaport Cutthroat and Cruel Celebrant with no outlet: worth a look`);
  o = await imb(C, "", ["Blood Artist", "Zulaport Cutthroat", "Cruel Celebrant", "Viscera Seer"]);
  ok(o.map(x => x.key).join() === "sacrifice" && /only one way to sacrifice \(Viscera Seer\)/.test(o[0].text), `${label}: with Viscera Seer alone, they rest on one outlet`);
  ok(await keys(C, "", ["Blood Artist", "Zulaport Cutthroat", "Cruel Celebrant", "Viscera Seer", "Goblin Bombardment"]) === "", `${label}: with two outlets: nothing to say`);
  ok(await keys(C, "", ["Viscera Seer", "Goblin Bombardment", "Blood Artist"]) === "", `${label}: two outlets and Blood Artist: no false "outlets without payoffs"`);
  ok(await keys(C, "", ["Massacre Wurm", "Grim Haruspex", "Lightning Bolt"]) === "", `${label}: Massacre Wurm (an opponent's creatures dying) isn't a payoff, so one payoff alone: nothing to say`);
  // ---- blink
  o = await imb(C, "", ["Cloudshift", "Ephemerate", "Lightning Bolt"]);
  ok(o.map(x => x.key).join() === "blink" && /2 cards that exile and return your permanents, but no permanent with an enters-the-battlefield ability/.test(o[0].text), `${label}: blink cards with nothing to blink: worth a look`);
  ok(await keys(C, "", ["Cloudshift", "Ephemerate", "Kor Skyfisher"]) === "", `${label}: add a creature with an enters ability: nothing to say`);
  ok(await keys(C, "", ["Kor Skyfisher", "Solemn Simulacrum", "Beetleback Chief"]) === "", `${label}: enters-the-battlefield creatures without blink cards are not flagged in an ordinary deck`);
  o = await imb(C, "Blink", ["Kor Skyfisher", "Solemn Simulacrum", "Beetleback Chief"]);
  ok(o.map(x => x.key).join() === "blink-theme" && o[0].sides[0].n === 3 && o[0].sides[1].n === 0, `${label}: but with the theme Blink, three possible payoffs and no blink card are worth a look`);
  ok(await keys(C, "Blink", ["Kor Skyfisher", "Solemn Simulacrum", "Beetleback Chief", "Ephemerate"]) === "", `${label}: and add a blink card: nothing to say`);
  // ---- instants and sorceries
  o = await imb(C, "", ["Guttersnipe", "Archmage Emeritus", "Flux Channeler"]);
  ok(o.map(x => x.key).join() === "spells" && o[0].sides[0].n === 3 && /3 cards that reward casting instants and sorceries, but no instants or sorceries/.test(o[0].text), `${label}: spell payoffs with no instants or sorceries: worth a look`);
  o = await imb(C, "", ["Guttersnipe", "Archmage Emeritus", "Flux Channeler", "Lightning Bolt"]);
  ok(o.map(x => x.key).join() === "spells" && /only one instant or sorcery \(Lightning Bolt\)/.test(o[0].text), `${label}: with one instant they rest on that one card: worth a look, naming it`);
  ok(await keys(C, "", ["Guttersnipe", "Archmage Emeritus", "Flux Channeler", "Lightning Bolt", "Counterspell"]) === "", `${label}: with two: nothing to say (no target number)`);
  ok(await keys(C, "", ["Lightning Bolt", "Counterspell", "Swords to Plowshares"]) === "", `${label}: instants without payoffs are just instants: nothing to say`);
  // ---- artifacts
  o = await imb(C, "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch"]);
  ok(o.map(x => x.key).join() === "artifacts" && o[0].sides[1].n === 0, `${label}: artifact payoffs with no artifacts: worth a look`);
  o = await imb(C, "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch", "Sol Ring"]);
  ok(o.length === 1 && /only one artifact or artifact maker \(Sol Ring\)/.test(o[0].text), `${label}: with Sol Ring alone they rest on one card`);
  ok(await keys(C, "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch", "Sol Ring", "Arcane Signet"]) === "", `${label}: with two artifacts: nothing to say`);
  // Treasure makers: Treasure is mana; no artifact payoff is needed for it to be useful
  ok(await keys(C, "", ["Smothering Tithe", "Goldspan Dragon", "Dockside Extortionist", "Pitiless Plunderer", "Big Score", "An Offer You Can't Refuse"]) === "", `${label}: four Treasure makers (plus incidental and opponent Treasure) and no artifact payoff: no observation`);
  o = await imb(C, "", ["Gilded Goose", "Savvy Hunter", "Whirler Rogue", "Lightning Bolt"]);
  ok(o.map(x => x.key).join() === "artifacts-makers" && o[0].sides[0].name === "Artifact token makers (not Treasure)" && o[0].sides[0].cards.slice().sort().join() === "Gilded Goose,Savvy Hunter,Whirler Rogue" && /3 cards that make artifact tokens other than Treasure, but no card that rewards artifacts/.test(o[0].text), `${label}: Food and Thopter makers with no artifact payoff keep their observation`);
  o = await imb(C, "", ["Gilded Goose", "Smothering Tithe", "Goldspan Dragon", "Pitiless Plunderer"]);
  ok(o.length === 0, `${label}: one Food maker among Treasure makers: the Treasure makers don't count, one card alone: no observation`);
  o = await imb(C, "", ["Tireless Provisioner", "Gilded Goose", "Smothering Tithe"]);
  ok(o.map(x => x.key).join() === "artifacts-makers" && o[0].sides[0].cards.slice().sort().join() === "Gilded Goose,Tireless Provisioner", `${label}: Tireless Provisioner ("a Food token or a Treasure token") makes more than Treasure: it counts; Smothering Tithe doesn't`);
  ok(await keys(C, "", ["Gilded Goose", "Whirler Rogue", "Padeem, Consul of Innovation"]) === "", `${label}: with an artifact payoff: no observation`);
  // artifact payoffs still see Treasure makers as artifact support
  o = await imb(C, "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch", "Smothering Tithe"]);
  ok(o.map(x => x.key).join() === "artifacts" && /only one artifact or artifact maker \(Smothering Tithe\)/.test(o[0].text), `${label}: artifact payoffs whose only artifact source is a Treasure maker: still worth a look, naming it`);
  ok(await keys(C, "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch", "Smothering Tithe", "Goldspan Dragon"]) === "", `${label}: two Treasure makers support three artifact payoffs: nothing to say`);
  ok(await keys(C, "", ["Storm-Kiln Artist", "Smothering Tithe", "Goldspan Dragon"]) === "", `${label}: Storm-Kiln Artist both makes Treasure and rewards artifacts: nothing to say`);
  ok(await keys(C, "", ["Smothering Tithe", "Big Score", "An Offer You Can't Refuse"]) === "", `${label}: one direct Treasure maker plus incidental and opponent Treasure: nothing to say`);
  // ---- counters
  o = await imb(C, "", ["Flux Channeler", "Travel Preparations", "Katsumasa, the Animator"]);
  ok(o.map(x => x.key).join() === "counters-makers" && o[0].sides[0].n === 3, `${label}: three cards that put counters on things and none that rewards counters: worth a look`);
  ok(await keys(C, "", ["Flux Channeler", "Travel Preparations", "Katsumasa, the Animator", "Herald of Secret Streams"]) === "", `${label}: add a counters payoff: nothing to say`);
  ok(await keys(C, "", ["Herald of Secret Streams", "Lightning Bolt"]) === "", `${label}: one payoff alone: nothing to say`);
  o = await imb(C, "", ["Fathom Mage", "Bred for the Hunt", "Hardened Scales"]);
  ok(o.map(x => x.key).join() === "counters" && o[0].sides[0].n === 3 && o[0].sides[1].n === 0, `${label}: Fathom Mage, Bred for the Hunt and Hardened Scales reward counters; nothing puts counters on things: worth a look`);
  o = await imb(C, "", ["Fathom Mage", "Bred for the Hunt", "Hardened Scales", "Travel Preparations"]);
  ok(o.map(x => x.key).join() === "counters" && /only one card that puts counters on things \(Travel Preparations\)/.test(o[0].text), `${label}: with one card that puts counters, they rest on it`);
  ok(await keys(C, "", ["Fathom Mage", "Bred for the Hunt", "Hardened Scales", "Travel Preparations", "Flux Channeler"]) === "", `${label}: with two: nothing to say`);
  ok(await keys(C, "", ["Krenko, Tin Street Kingpin", "Walking Ballista", "Lightning Bolt"]) === "", `${label}: cards that put counters only on themselves are neither side: nothing to say`);
  // ---- landfall
  o = await imb(C, "", ["Lotus Cobra", "Steppe Lynx"]);
  ok(o.map(x => x.key).join() === "landfall" && /about once a turn, from your land drop/.test(o[0].text), `${label}: landfall payoffs with nothing that puts extra lands onto the battlefield: worth a look`);
  ok(await keys(C, "", ["Lotus Cobra", "Steppe Lynx", "Azusa, Lost but Seeking"]) === "", `${label}: add Azusa (extra land drops): nothing to say`);
  // ---- lifegain
  o = await imb(C, "", ["Ajani's Pridemate", "Bloodbond Vampire", "Staff of Domination", "Swords to Plowshares"]);
  ok(o.map(x => x.key).join() === "lifegain" && o[0].sides[1].n === 0 && /incidental life gain isn't counted/.test(o[0].text), `${label}: lifegain payoffs; Staff of Domination's 1 life (incidental) and Swords to Plowshares' (the opponent's) don't count: worth a look`);
  ok(await keys(C, "", ["Ajani's Pridemate", "Bloodbond Vampire", "Soul Warden"]) === "", `${label}: add Soul Warden: nothing to say`);
  ok(await keys(C, "", ["Ajani's Pridemate", "Sanguine Bond", "Blood Artist"]) === "", `${label}: Blood Artist's "…and you gain 1 life" is a way to gain life: nothing to say`);
  o = await imb(C, "", ["Ajani's Pridemate", "Sanguine Bond", "Fiery Justice", "Mirkwood Bats", "Swords to Plowshares"]);
  ok(o.map(x => x.key).join() === "lifegain" && o[0].sides[1].n === 0, `${label}: an opponent gaining life (Fiery Justice, Swords) or losing it (Mirkwood Bats) is no way for you to gain life: worth a look`);
  // ---- unique cards and copies; one card on several strategies
  o = await imb(C, "", [["Guttersnipe", 3], "Archmage Emeritus", "Flux Channeler"]);
  ok(o[0].sides[0].n === 3 && o[0].sides[0].copies === 5, `${label}: three different payoffs, five copies, counted apart`);
  o = await imb(C, "", ["Flux Channeler", "Guttersnipe", "Archmage Emeritus", "Travel Preparations", "Katsumasa, the Animator"]);
  ok(o.map(x => x.key).sort().join() === "counters-makers,spells" && o.find(x => x.key === "spells").sides[0].cards.includes("Flux Channeler") && o.find(x => x.key === "counters-makers").sides[0].cards.includes("Flux Channeler"), `${label}: Flux Channeler is a spell payoff and a counter maker: it counts once in each strategy`);
  // ---- strategies with both sides, real decks: nothing invented
  ok(await keys("Krenko, Mob Boss", "Goblins", ["Krenko's Command", "Dragon Fodder", "Intangible Virtue", "Skullclamp", "Viscera Seer", "Mogg War Marshal", "Coat of Arms"]) === "", `${label}: a Goblin deck with makers, payoffs and outlets: no observation`);
  // ---- no targets or ratios in any text
  const all = await p.evaluate(() => [
    IMB("Grenzo, Havoc Raiser", "", ["Intangible Virtue", "Mirkwood Bats"]), IMB("Grenzo, Havoc Raiser", "", ["Anointed Procession", "Divine Visitation"]), IMB("Grenzo, Havoc Raiser", "", ["Mogg War Marshal", "Solemn Simulacrum"]),
    IMB("Grenzo, Havoc Raiser", "", ["Viscera Seer", "Goblin Bombardment"]), IMB("Grenzo, Havoc Raiser", "", ["Cloudshift", "Ephemerate"]), IMB("Grenzo, Havoc Raiser", "Blink", ["Kor Skyfisher", "Beetleback Chief"]),
    IMB("Grenzo, Havoc Raiser", "", ["Guttersnipe", "Archmage Emeritus", "Flux Channeler", "Lightning Bolt"]), IMB("Grenzo, Havoc Raiser", "", ["Padeem, Consul of Innovation", "Thoughtcast", "Dispatch", "Sol Ring"]),
    IMB("Grenzo, Havoc Raiser", "", ["Gilded Goose", "Whirler Rogue"]), IMB("Grenzo, Havoc Raiser", "", ["Flux Channeler", "Travel Preparations"]), IMB("Grenzo, Havoc Raiser", "", ["Lotus Cobra", "Steppe Lynx"]), IMB("Grenzo, Havoc Raiser", "", ["Ajani's Pridemate", "Bloodbond Vampire"])
  ].flat().map(o => o.text));
  ok(all.length === 12 && all.every(t => !/\bratio\b|\bat least\b|\bshould (have|run|play)\b|\bneeds? \d|\brecommended\b|\bideal\b|\btarget\b|%/.test(t)), `${label}: all 12 kinds of observation: no ratios, targets or percentages in the wording`);
  ok(all.every(t => (t.match(/\d+/g) || []).every(x => +x <= 5)), `${label}: and every number in them is a count from the deck`);

  // ---- in the app: the section, expanding, cards with reasons, disappearing when resolved
  await p.evaluate(() => {
    const mk = (id, cmd, names) => { const d = { id, name: id, format: "commander", cmdr: [], cards: {}, themes: [], created: 1, updated: 9 }; S.decks[id] = d; addToDeck(d, CARD(cmd), 1, false, true); d.cmdr = Object.keys(d.cards); addToDeck(d, CARD("Mountain"), 30, false, true); for (const [n, q] of names) addToDeck(d, CARD(n), q, false, true); return d; };
    mk("s", "Grenzo, Havoc Raiser", [["Skullclamp", 1], ["Mogg War Marshal", 2], ["Solemn Simulacrum", 1], ["Lightning Bolt", 1]]);
    mk("ok", "Krenko, Mob Boss", [["Krenko's Command", 1], ["Intangible Virtue", 1], ["Mirkwood Bats", 1]]);
    S.roles = { "Lightning Bolt": ["Removal", "Protection"] }; addToColl(slim(CARD("Viscera Seer")), "nonfoil", 2, "main", true); save();
  });
  await p.waitForTimeout(500);
  const state = () => p.evaluate(async () => JSON.stringify({ S, ls: Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]), base: await idbGet("syncBase").catch(() => null) }));
  const s0 = await state();
  const open = async id => { await p.evaluate(id => { deckTab[id] = "balance"; balMode[id] = "optimize"; go("decks", id); }, id); await p.waitForSelector("#opImb", { state: "attached" }); await p.$$eval("#op details", a => a.forEach(d => { d.open = true; })); };
  await open("s");
  ok(await p.$$eval("#opImb .op-imb", a => a.length) === 1 && /^Worth a look Sacrifice sacrifice fodder: 2 · sacrifice outlets: 0$/.test(await txt("#op-imb-sacrifice-fodder > summary")), `${label}: one "Worth a look" in the section, with its counts (${await txt("#op-imb-sacrifice-fodder > summary")})`);
  ok(/Sacrifice fodder · 2 cards, 3 copies/.test(await txt("#op-imb-sacrifice-fodder")) && /Sacrifice outlets · 0 cards\s*None in this deck\./.test(await txt("#op-imb-sacrifice-fodder")), `${label}: each side: unique cards, then copies; an empty side says so`);
  ok((await p.$$eval("#op-imb-sacrifice-fodder [data-side='Sacrifice fodder'] .op-card", a => a.map(x => x.dataset.name))).join() === "Mogg War Marshal,Solemn Simulacrum" && /Does something when it dies \(good to sacrifice\) · “When this creature enters or dies”/.test(await txt("#op-imb-sacrifice-fodder")), `${label}: expanded, it names the cards and why each one qualifies`);
  ok(/Deckhand has no target numbers/.test(await txt("#op-imb-sacrifice-fodder")), `${label}: and says there are no target numbers`);
  ok(/^3 cards · 4 copies · 0 enabling · 1 rewarding · 2 fodder$/.test(await txt("#op-st-sacrifice > summary .num")), `${label}: the strategy heading above agrees: 0 outlets (enabling), 1 payoff, 2 fodder (${await txt("#op-st-sacrifice > summary .num")})`);
  ok(await state() === s0, `${label}: opening and reading the analysis changes nothing: the app's data, saved roles, your fixes, quantities, deck contents, local storage and the sync record are exactly as before`);
  // the player adds an outlet themselves: the observation goes away
  await p.evaluate(() => { addToDeck(S.decks.s, CARD("Viscera Seer"), 1, false); renderDeck(S.decks.s); }); await p.waitForSelector("#opImb", { state: "attached" });
  ok(await p.$$eval("#opImb .op-imb", a => a.length) === 0 && /No significant strategy imbalances identified\./.test(await txt("#opImb")), `${label}: after adding a way to sacrifice, it is gone and the section says there is nothing to report`);
  await open("ok");
  ok(/No significant strategy imbalances identified\./.test(await txt("#opImb")), `${label}: a deck with both sides says so too`);
  await p.evaluate(() => { const d = S.decks.s; delete d.cards[Object.keys(d.cards).find(k => d.cards[k].name === "Viscera Seer")]; save(); });       // undo the test's own addition before comparing
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => JSON.stringify(S.roles)) === '{"Lightning Bolt":["Removal","Protection"]}' && await p.evaluate(() => [...Object.values(S.coll), ...Object.values(S.decks).flatMap(d => Object.values(d.cards))].every(c => !("sy" in c) && !("imb" in c))), `${label}: your role fix is untouched and no card carries anything new`);
  // layout
  await open("s");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll("#opImb, #opImb summary, #opImb .op-card")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1) && [...document.querySelectorAll("#opImb details > summary")].every(e => e.getBoundingClientRect().height >= 32)), `${label}: fits the screen; headings big enough to tap`);
  if (process.env.SHOTS) await (await p.$("#op-strat")).screenshot({ path: `/tmp/imb_${label}.png` });
  ok(!errs.length, `${label}: no page errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8908", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
