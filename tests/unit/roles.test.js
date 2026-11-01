const fs = require("fs"); const src = fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8");
const body = src.slice(src.indexOf("function cardRoles("), src.indexOf("const rolesOf"));
const cardRoles = eval("(" + body.trim() + ")");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const cases = [
 ["Sol Ring", "Artifact", "{T}: Add {C}{C}.", ["Ramp"]],
 ["Arcane Signet", "Artifact", "{T}: Add one mana of any color in your commander's color identity.", ["Ramp"]],
 ["Command Tower", "Land", "{T}: Add one mana of any color in your commander's color identity.", ["Land"]],
 ["Cultivate", "Sorcery", "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.", ["Ramp"]],
 ["Three Visits", "Sorcery", "Search your library for a Forest card, put that card onto the battlefield, then shuffle.", ["Ramp"]],
 ["Llanowar Elves", "Creature — Elf Druid", "{T}: Add {G}.", ["Ramp", "Creature"]],
 ["Rhystic Study", "Enchantment", "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.", ["Card draw"]],
 ["Harmonize", "Sorcery", "Draw three cards.", ["Card draw"]],
 ["Swords to Plowshares", "Instant", "Exile target creature. Its controller gains life equal to its power.", ["Removal"]],
 ["Path to Exile", "Instant", "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.", ["Removal"]],
 ["Beast Within", "Instant", "Destroy target permanent. Its controller creates a 3/3 green Beast creature token.", ["Removal"]],
 ["Lightning Bolt", "Instant", "Lightning Bolt deals 3 damage to any target.", ["Removal"]],
 ["Wrath of God", "Sorcery", "Destroy all creatures. They can't be regenerated.", ["Board wipe"]],
 ["Blasphemous Act", "Sorcery", "This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature.", ["Board wipe"]],
 ["Counterspell", "Instant", "Counter target spell.", ["Counterspell"]],
 ["Fierce Guardianship", "Instant", "If you control a commander, you may cast this spell without paying its mana cost.\nCounter target noncreature spell.", ["Counterspell"]],
 ["Heroic Intervention", "Instant", "Permanents you control gain hexproof and indestructible until end of turn.", ["Protection"]],
 ["Teferi's Protection", "Instant", "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out.", ["Protection"]],
 ["Demonic Tutor", "Sorcery", "Search your library for a card, put that card into your hand, then shuffle.", ["Tutor"]],
 ["Eternal Witness", "Creature — Human Shaman", "When Eternal Witness enters, return target card from your graveyard to your hand.", ["Recursion", "Creature"]],
 ["Goblin Warchief", "Creature — Goblin Warrior", "Goblin spells you cast cost {1} less to cast.\nGoblins you control have haste.", ["Creature"]],
 ["Smothering Tithe", "Enchantment", "Whenever an opponent draws a card, that player may pay {2}. If they don't, you create a Treasure token.", ["Ramp"]],
];
let right = 0;
for (const [n, ty, tx, want] of cases) { const got = cardRoles(tx, ty); const good = JSON.stringify(got) === JSON.stringify(want); right += good; if (!good) console.log("   ", n, "→", got.join(", "), " wanted", want.join(", ")); }
ok(right === cases.length, `roles from rules text: ${right}/${cases.length} cards tagged as expected`);
