// Commander pairing legality (CR 702.124, effective Sept 25, 2026): two commanders are allowed only when an ability of one
// matches an ability of the other — Partner with Partner, Partner with [name] when each names the other, Partner—[text] with
// the same text, Choose a Background with a legendary Background, Doctor's companion with a legendary Time Lord Doctor.
// Real cards with their real Oracle text (Scryfall Oracle Cards bulk data, Nov 16, 2026), run through the app's own slim(),
// addToDeck() and checkDeck(); the paste and file imports go through the real import screens.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// trimmed to the fields Deckhand reads; oracle_text and type_line exactly as Scryfall has them
const ORACLE = [{"id":"bc7cbe9b-324e-42b8-94e2-36e91cb32163","oracle_id":"d15642e4-e61c-4d29-af48-de837991245e","name":"Tymna the Weaver","set":"c16","set_name":"Commander 2016","collector_number":"48","rarity":"rare","type_line":"Legendary Creature — Human Cleric","cmc":3.0,"mana_cost":"{1}{W}{B}","colors":["B","W"],"color_identity":["B","W"],"oracle_text":"Lifelink\nAt the beginning of each of your postcombat main phases, you may pay X life, where X is the number of opponents that were dealt combat damage this turn. If you do, draw X cards.\nPartner (You can have two commanders if both have partner.)","layout":"normal","finishes":["foil"],"legalities":{"commander":"legal"}},
{"id":"21e27b91-c7f1-4709-aa0d-8b5d81b22a0a","oracle_id":"3d867016-2601-4a37-a73d-308898d3bd37","name":"Thrasios, Triton Hero","set":"c16","set_name":"Commander 2016","collector_number":"46","rarity":"rare","type_line":"Legendary Creature — Merfolk Wizard","cmc":2.0,"mana_cost":"{G}{U}","colors":["G","U"],"color_identity":["G","U"],"oracle_text":"{4}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise, draw a card.\nPartner (You can have two commanders if both have partner.)","layout":"normal","finishes":["foil"],"legalities":{"commander":"legal"}},
{"id":"5a7241f5-4d69-47fe-b037-95037008184c","oracle_id":"7683c2b2-a06f-4691-9cc5-1968dc032885","name":"Pir, Imaginative Rascal","set":"bbd","set_name":"Battlebond","collector_number":"11","rarity":"rare","type_line":"Legendary Creature — Human","cmc":3.0,"mana_cost":"{2}{G}","colors":["G"],"color_identity":["G"],"oracle_text":"Partner with Toothy, Imaginary Friend (When this creature enters, target player may put Toothy into their hand from their library, then shuffle.)\nIf one or more counters would be put on a permanent your team controls, that many plus one of each of those kinds of counters are put on that permanent instead.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"ebdf2f50-f69a-47c4-a75f-ff55781bb0c8","oracle_id":"41d6cce0-b852-4d0e-aee2-081df13dd9b8","name":"Toothy, Imaginary Friend","set":"bbd","set_name":"Battlebond","collector_number":"12","rarity":"rare","type_line":"Legendary Creature — Illusion","cmc":4.0,"mana_cost":"{3}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Partner with Pir, Imaginative Rascal (When this creature enters, target player may put Pir into their hand from their library, then shuffle.)\nWhenever you draw a card, put a +1/+1 counter on Toothy.\nWhen Toothy leaves the battlefield, draw a card for each +1/+1 counter on it.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"9b4fdcd5-5346-46a8-b1a4-84ddb74089e0","oracle_id":"464df46a-079b-47c1-95e7-930160abef2f","name":"Brallin, Skyshark Rider","set":"c20","set_name":"Commander 2020","collector_number":"4","rarity":"mythic","type_line":"Legendary Creature — Human Shaman","cmc":4.0,"mana_cost":"{3}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Partner with Shabraz, the Skyshark (When this creature enters, target player may put Shabraz into their hand from their library, then shuffle.)\nWhenever you discard a card, put a +1/+1 counter on Brallin and it deals 1 damage to each opponent.\n{R}: Target Shark gains trample until end of turn.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"9955d172-0b24-4c61-9dee-c935a1f26da2","oracle_id":"7599fe9a-b6a5-491b-a308-aef3bf1e9daf","name":"Shabraz, the Skyshark","set":"c20","set_name":"Commander 2020","collector_number":"14","rarity":"mythic","type_line":"Legendary Creature — Shark Bird","cmc":5.0,"mana_cost":"{3}{W}{U}","colors":["U","W"],"color_identity":["U","W"],"oracle_text":"Partner with Brallin, Skyshark Rider\nFlying\nWhenever you draw a card, put a +1/+1 counter on Shabraz and you gain 1 life.\n{W/U}: Target Human gains flying until end of turn.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"dfe0daf8-43da-484b-baa1-76f8313c5a0c","oracle_id":"d2766fd7-5cf9-4037-9f34-9ae3982c613a","name":"Wilson, Refined Grizzly","set":"clb","set_name":"Commander Legends: Battle for Baldur's Gate","collector_number":"261","rarity":"uncommon","type_line":"Legendary Creature — Bear Warrior","cmc":2.0,"mana_cost":"{1}{G}","colors":["G"],"color_identity":["G"],"oracle_text":"This spell can't be countered.\nVigilance, reach, trample\nWard {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nChoose a Background (You can have a Background as a second commander.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"abe5cc84-db39-4f64-b877-599880a8729a","oracle_id":"aceac269-5100-428a-a4a3-bac57031e30b","name":"Guild Artisan","set":"clb","set_name":"Commander Legends: Battle for Baldur's Gate","collector_number":"179","rarity":"uncommon","type_line":"Legendary Enchantment — Background","cmc":2.0,"mana_cost":"{1}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Commander creatures you own have \"Whenever this creature attacks a player, if no opponent has more life than that player, you create two Treasure tokens.\" (They're artifacts with \"{T}, Sacrifice this token: Add one mana of any color.\")","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"cba131bb-b8b3-4577-9f41-4700d9985134","oracle_id":"0073d731-e60d-433a-ac35-a22af855da20","name":"Dungeon Delver","set":"clb","set_name":"Commander Legends: Battle for Baldur's Gate","collector_number":"67","rarity":"uncommon","type_line":"Legendary Enchantment — Background","cmc":2.0,"mana_cost":"{1}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Commander creatures you own have \"Room abilities of dungeons you own trigger an additional time.\"","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"e0a64924-068e-483f-91a6-d450b67b3c75","oracle_id":"095dabda-4570-4764-8d62-4a29eb19d3e6","name":"Sophina, Spearsage Deserter","set":"slx","set_name":"Universes Within","collector_number":"7","rarity":"rare","type_line":"Legendary Creature — Human Soldier","cmc":4.0,"mana_cost":"{2}{R}{W}","colors":["R","W"],"color_identity":["R","W"],"oracle_text":"Menace\nWhenever Sophina, Spearsage Deserter attacks, investigate once for each nontoken attacking creature. (To investigate, create a Clue token. It's an artifact with \"{2}, Sacrifice this artifact: Draw a card.\")\nPartner—Friends forever (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil"],"legalities":{"commander":"legal"}},
{"id":"b867fb22-4f2a-47aa-9432-1bcc5e731947","oracle_id":"4ee401bf-dc86-41a9-84f9-57aa0a314d08","name":"Othelm, Sigardian Outcast","set":"slx","set_name":"Universes Within","collector_number":"6","rarity":"rare","type_line":"Legendary Creature — Human","cmc":3.0,"mana_cost":"{1}{G}{W}","colors":["G","W"],"color_identity":["G","W"],"oracle_text":"{2}, {T}: Choose target creature card in your graveyard that was put there from the battlefield this turn. Return it to the battlefield tapped.\nPartner—Friends forever (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil"],"legalities":{"commander":"legal"}},
{"id":"774716f4-d211-497a-be91-69cd700edbf2","oracle_id":"1ba2f763-5895-4663-b38f-95591ebb2ef4","name":"Donatello, the Brains","set":"tmc","set_name":"Teenage Mutant Ninja Turtles Eternal","collector_number":"2","rarity":"mythic","type_line":"Legendary Creature — Mutant Ninja Turtle","cmc":3.0,"mana_cost":"{2}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"If one or more tokens would be created under your control, those tokens plus a Mutagen token are created instead.\nPartner—Character select (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"bccdd54c-e64b-44d2-87b3-e80029672529","oracle_id":"22008c3b-6e15-41cc-a15c-7871495191aa","name":"Raphael, the Muscle","set":"tmc","set_name":"Teenage Mutant Ninja Turtles Eternal","collector_number":"4","rarity":"mythic","type_line":"Legendary Creature — Mutant Ninja Turtle","cmc":5.0,"mana_cost":"{4}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Double all damage that creatures you control with counters on them would deal.\nWhen Raphael enters, create a Mutagen token.\nPartner—Character select (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"77dcd29e-d0d5-474f-a05b-768ccf6b6293","oracle_id":"c000d5c3-5b0c-4c5c-9919-76640da0a1e4","name":"Kratos, Stoic Father","set":"sld","set_name":"Secret Lair Drop","collector_number":"2213","rarity":"mythic","type_line":"Legendary Creature — God Warrior","cmc":4.0,"mana_cost":"{2}{R}{W}","colors":["R","W"],"color_identity":["R","W"],"oracle_text":"Whenever you attack with one or more Gods and whenever a God dies, you get an experience counter.\nAt the beginning of your end step, put a number of +1/+1 counters on target creature equal to the number of experience counters you have.\nPartner—Father & son (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"2e53b0b2-dba1-4a95-80c4-622ab1a547a4","oracle_id":"f6a4298c-3d9d-43e1-b32c-b168c02ad503","name":"Atreus, Impulsive Son","set":"sld","set_name":"Secret Lair Drop","collector_number":"2212","rarity":"mythic","type_line":"Legendary Creature — God Archer","cmc":3.0,"mana_cost":"{1}{U}{R}","colors":["R","U"],"color_identity":["R","U"],"oracle_text":"Reach\n{3}, {T}: Draw a card for each experience counter you have, then discard a card. Atreus deals 2 damage to each opponent.\nPartner—Father & son (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"e973462f-589d-4c53-81d7-075ec1d5a9b4","oracle_id":"299ff264-c6db-4b48-88fb-ca006cb84f88","name":"Ellie, Brick Master","set":"sld","set_name":"Secret Lair Drop","collector_number":"2197","rarity":"mythic","type_line":"Legendary Creature — Human Survivor","cmc":2.0,"mana_cost":"{1}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Distract the Horde — Whenever a player attacks one of your opponents, that attacking player creates a tapped 1/1 black Fungus Zombie creature token named Cordyceps Infected that's attacking that opponent.\nPartner—Survivors (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"713ab02f-cd48-420d-a2fe-ef460e6ce2d2","oracle_id":"64611260-c9f7-4375-b67a-f88fee6d3bff","name":"Joel, Resolute Survivor","set":"sld","set_name":"Secret Lair Drop","collector_number":"2198","rarity":"mythic","type_line":"Legendary Creature — Human Survivor","cmc":5.0,"mana_cost":"{3}{B}{G}","colors":["B","G"],"color_identity":["B","G"],"oracle_text":"Menace\nWhenever a creature token dies, put a +1/+1 counter on Joel and draw a card. This ability triggers only once each turn.\nPartner—Survivors (You can have two commanders if both have this ability.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"b6ffec6a-fbba-46cc-becb-4ee5ef8c4971","oracle_id":"0d6e76aa-2966-48b7-be4e-2d3e2cc94fc1","name":"Donna Noble","set":"who","set_name":"Doctor Who","collector_number":"82","rarity":"rare","type_line":"Legendary Creature — Human","cmc":4.0,"mana_cost":"{3}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Soulbond (You may pair this creature with another unpaired creature when either enters. They remain paired for as long as you control both of them.)\nWhenever Donna Noble or a creature it's paired with is dealt damage, Donna Noble deals that much damage to target opponent.\nDoctor's companion (You can have two commanders if the other is the Doctor.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"f1499f49-793b-4265-9ad0-883a431941ab","oracle_id":"23af0a0a-1d12-47c7-b191-2bd3f84eea93","name":"The Tenth Doctor","set":"who","set_name":"Doctor Who","collector_number":"3","rarity":"mythic","type_line":"Legendary Creature — Time Lord Doctor","cmc":5.0,"mana_cost":"{3}{U}{R}","colors":["R","U"],"color_identity":["R","U"],"oracle_text":"Allons-y! — Whenever you attack, exile cards from the top of your library until you exile a nonland card. Put three time counters on it. If it doesn't have suspend, it gains suspend.\nTimey-Wimey — {7}: Time travel three times. Activate only as a sorcery. (For each suspended card you own and each permanent you control with a time counter on it, you may add or remove a time counter. Then do it two more times.)","layout":"normal","finishes":["foil"],"legalities":{"commander":"legal"}},
{"id":"f872a2cd-e684-47be-885f-27a4666399fa","oracle_id":"43c31a03-2bbd-49a6-8b78-c5f3cab04a07","name":"Doctor Strange, Surgeon","set":"msc","set_name":"Marvel Super Heroes Commander","collector_number":"591","rarity":"rare","type_line":"Legendary Creature — Human Doctor Hero","cmc":5.0,"mana_cost":"{4}{W}","colors":["W"],"color_identity":["W"],"oracle_text":"Lifelink\nIf you would gain life, you gain twice that much life instead.\nAt the beginning of each combat, if you have at least 10 life more than your starting life total, creatures you control get +2/+2 and gain vigilance until end of turn.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"not_legal"}},
{"id":"4ccc3ebd-34e1-421c-87b4-0be905954289","oracle_id":"3346a585-d35a-4f8b-b9ab-7e453ebd15f4","name":"Romana II","set":"who","set_name":"Doctor Who","collector_number":"27","rarity":"rare","type_line":"Legendary Creature — Time Lord Scientist","cmc":4.0,"mana_cost":"{3}{W}","colors":["W"],"color_identity":["W"],"oracle_text":"Vigilance\n{1}, {T}: Create a tapped token that's a copy of target token that entered this turn.\nDoctor's companion (You can have two commanders if the other is the Doctor.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"01b44c52-b3a3-4954-adcc-53b79921ea24","oracle_id":"ac9b0bdf-caf8-4dba-a900-e59de35e77d7","name":"The Rani","set":"who","set_name":"Doctor Who","collector_number":"149","rarity":"rare","type_line":"Legendary Creature — Time Lord Scientist","cmc":4.0,"mana_cost":"{1}{U}{B}{R}","colors":["B","R","U"],"color_identity":["B","R","U"],"oracle_text":"Whenever The Rani enters or attacks, create a red Aura enchantment token named Mark of the Rani attached to another target creature. That token has enchant creature and \"Enchanted creature gets +2/+2 and is goaded.\"\nWhenever a goaded creature deals combat damage to one of your opponents, investigate.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"d0d33d52-3d28-4635-b985-51e126289259","oracle_id":"7e6b9b59-cd68-4e3c-827b-38833c92d6eb","name":"Atraxa, Praetors' Voice","set":"2xm","set_name":"Double Masters","collector_number":"190","rarity":"mythic","type_line":"Legendary Creature — Phyrexian Angel Horror","cmc":4.0,"mana_cost":"{G}{W}{U}{B}","colors":["B","G","U","W"],"color_identity":["B","G","U","W"],"oracle_text":"Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"824b2d73-2151-4e5e-9f05-8f63e2bdcaa9","oracle_id":"68418069-f615-40ef-ae0d-764192acae00","name":"Krenko, Mob Boss","set":"fdn","set_name":"Foundations","collector_number":"204","rarity":"rare","type_line":"Legendary Creature — Goblin Warrior","cmc":4.0,"mana_cost":"{2}{R}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"492c2f9a-51e7-4e0f-9899-23bf43ea988b","oracle_id":"d3a0b660-358c-41bd-9cd2-41fbf3491b1a","name":"Birds of Paradise","set":"msc","set_name":"Marvel Super Heroes Commander","collector_number":"170","rarity":"rare","type_line":"Creature — Bird","cmc":1.0,"mana_cost":"{G}","colors":["G"],"color_identity":["G"],"oracle_text":"Flying\n{T}: Add one mana of any color.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"7673784e-db4b-43a1-8d55-1bb9fc1e284f","oracle_id":"4457ed35-7c10-48c8-9776-456485fdf070","name":"Lightning Bolt","set":"msc","set_name":"Marvel Super Heroes Commander","collector_number":"806","rarity":"uncommon","type_line":"Instant","cmc":1.0,"mana_cost":"{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Lightning Bolt deals 3 damage to any target.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"e50a2faa-91e3-4e89-ba8d-2cbf7ac005c0","oracle_id":"aa7d3e99-fc14-4f62-bf00-c0428c11e4f2","name":"Amy Pond","set":"who","set_name":"Doctor Who","collector_number":"75","rarity":"rare","type_line":"Legendary Creature — Human","cmc":3.0,"mana_cost":"{2}{R}","colors":["R"],"color_identity":["R"],"oracle_text":"Partner with Rory Williams (When this creature enters, target player may put Rory into their hand from their library, then shuffle.)\nWhenever Amy Pond deals combat damage to a player, choose a suspended card you own and remove that many time counters from it.\nDoctor's companion (You can have two commanders if the other is the Doctor.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"f51a010d-641c-413f-8f91-0c8ff3b2085c","oracle_id":"16a44586-ea1d-45f1-b9de-da1c11f729df","name":"Rory Williams","set":"who","set_name":"Doctor Who","collector_number":"153","rarity":"rare","type_line":"Legendary Creature — Human Soldier","cmc":2.0,"mana_cost":"{W}{U}","colors":["U","W"],"color_identity":["U","W"],"oracle_text":"Partner with Amy Pond\nFirst strike, lifelink\nThe Last Centurion — When you cast this spell from anywhere other than exile, exile it with three time counters on it. It gains suspend. Then investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"91fdb56b-54d5-4272-8319-505ff987fe9b","oracle_id":"6ad8011d-3471-4369-9d68-b264cc027487","name":"Sol Ring","set":"msc","set_name":"Marvel Super Heroes Commander","collector_number":"211","rarity":"uncommon","type_line":"Artifact","cmc":1.0,"mana_cost":"{1}","colors":[],"color_identity":[],"oracle_text":"{T}: Add {C}{C}.","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"24dc369c-020a-4115-a4bb-d60a44de64e3","oracle_id":"bc71ebf6-2056-41f7-be35-b2e5c34afa99","name":"Plains","set":"hob","set_name":"The Hobbit","collector_number":"194","rarity":"common","type_line":"Basic Land — Plains","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["W"],"oracle_text":"({T}: Add {W}.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"739aaaac-c424-4ea7-a084-62a6fc0438b0","oracle_id":"b2c6aa39-2d2a-459c-a555-fb48ba993373","name":"Island","set":"hob","set_name":"The Hobbit","collector_number":"195","rarity":"common","type_line":"Basic Land — Island","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["U"],"oracle_text":"({T}: Add {U}.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"c5f590a3-9993-4ac4-a93c-1beb44eda17b","oracle_id":"56719f6a-1a6c-4c0a-8d21-18f7d7350b68","name":"Swamp","set":"hob","set_name":"The Hobbit","collector_number":"196","rarity":"common","type_line":"Basic Land — Swamp","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["B"],"oracle_text":"({T}: Add {B}.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"5f533364-0f91-4e49-aaeb-83c4c1f6d316","oracle_id":"b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6","name":"Forest","set":"hob","set_name":"The Hobbit","collector_number":"198","rarity":"common","type_line":"Basic Land — Forest","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["G"],"oracle_text":"({T}: Add {G}.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
{"id":"51acfb01-4b0b-48fc-9704-a9b4a1e43a23","oracle_id":"a3fb7228-e76b-4e96-a40e-20b5fed75685","name":"Mountain","set":"hob","set_name":"The Hobbit","collector_number":"197","rarity":"common","type_line":"Basic Land — Mountain","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["R"],"oracle_text":"({T}: Add {R}.)","layout":"normal","finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}}];
const BY = Object.fromEntries(ORACLE.map(c => [c.name, Object.assign({ object: "card", set_name: c.set_name || "", prices: { usd: "1" },
  image_uris: { small: "https://cards.scryfall.io/small/" + c.id + ".png", normal: "https://cards.scryfall.io/normal/" + c.id + ".png" } }, c)]));

const TY = "Tymna the Weaver", TH = "Thrasios, Triton Hero", PIR = "Pir, Imaginative Rascal", TOO = "Toothy, Imaginary Friend", BRA = "Brallin, Skyshark Rider", SHA = "Shabraz, the Skyshark",
  WIL = "Wilson, Refined Grizzly", GA = "Guild Artisan", DD = "Dungeon Delver", SOP = "Sophina, Spearsage Deserter", OTH = "Othelm, Sigardian Outcast", DON = "Donatello, the Brains",
  RAP = "Raphael, the Muscle", KRA = "Kratos, Stoic Father", ATR = "Atreus, Impulsive Son", ELL = "Ellie, Brick Master", JOE = "Joel, Resolute Survivor", DNA = "Donna Noble",
  TEN = "The Tenth Doctor", STR = "Doctor Strange, Surgeon", ROM = "Romana II", RANI = "The Rani", ATX = "Atraxa, Praetors' Voice", KRE = "Krenko, Mob Boss", AMY = "Amy Pond", RORY = "Rory Williams";
// the expected messages, word for word
const PW = "Partner with only pairs with the card it names, and that card has to name it back.", VAR = "A Partner— ability only pairs with the same Partner— ability.",
  BG = "Choose a Background only pairs with a legendary Background, and a Background can only be a commander that way.",
  DOC = "Doctor's companion only pairs with a legendary Time Lord Doctor creature.", NONE = "Two commanders need matching pairing abilities, such as Partner on both.";
const no = (A, a, B, b, why) => `${A} (${a}) and ${B} (${b}) can't be commanders together. ${why}`;
const CANT = n => `${n} can't be a commander. It has to be a legendary creature or say it can be your commander.`;
const DUP = n => `${n} is chosen as both commanders. Choose a different second commander.`;
const CI1 = "1 card is outside your commander's colors.";

// [label, commanders, other cards, expected commander-related issues]
const MATRIX = [
  ["Two plain Partner: Tymna + Thrasios", [TY, TH], [], []],
  ["Partner with, the named pair: Pir + Toothy", [PIR, TOO], [], []],
  ["Partner with, the named pair the other way round: Toothy + Pir", [TOO, PIR], [], []],
  ["Partner with written without reminder text: Shabraz + Brallin", [SHA, BRA], [], []],
  ["Partner with + plain Partner: Pir + Tymna", [PIR, TY], [], [no(PIR, "Partner with " + TOO, TY, "Partner", PW)]],
  ["Partner with naming someone else: Pir + Brallin", [PIR, BRA], [], [no(PIR, "Partner with " + TOO, BRA, "Partner with " + SHA, PW)]],
  ["Choose a Background + a Background: Wilson + Guild Artisan", [WIL, GA], [], []],
  ["The Background chosen first: Guild Artisan + Wilson", [GA, WIL], [], []],
  ["Choose a Background + a Partner creature: Wilson + Tymna", [WIL, TY], [], [no(WIL, "Choose a Background", TY, "Partner", BG)]],
  ["A Partner creature + a Background: Tymna + Guild Artisan", [TY, GA], [], [no(TY, "Partner", GA, "a Background", BG)]],
  ["Two Backgrounds: Guild Artisan + Dungeon Delver", [GA, DD], [], [no(GA, "a Background", DD, "a Background", BG)]],
  ["A Background alone: Guild Artisan", [GA], [], [CANT(GA)]],
  ["Partner—Friends forever pair: Sophina + Othelm", [SOP, OTH], [], []],
  ["Partner—Friends forever + plain Partner: Sophina + Tymna", [SOP, TY], [], [no(SOP, "Partner—Friends forever", TY, "Partner", VAR)]],
  ["Partner—Character select pair: Donatello + Raphael", [DON, RAP], [], []],
  ["Partner—Character select + Partner—Friends forever: Donatello + Sophina", [DON, SOP], [], [no(DON, "Partner—Character select", SOP, "Partner—Friends forever", VAR)]],
  ["Partner—Father & son pair: Kratos + Atreus", [KRA, ATR], [], []],
  ["Partner—Survivors pair: Ellie + Joel", [ELL, JOE], [], []],
  ["Partner—Survivors + Partner—Father & son: Ellie + Kratos", [ELL, KRA], [], [no(ELL, "Partner—Survivors", KRA, "Partner—Father & son", VAR)]],
  ["Doctor's companion + a Time Lord Doctor: Donna Noble + The Tenth Doctor", [DNA, TEN], [], []],
  ["The Doctor chosen first: The Tenth Doctor + Donna Noble", [TEN, DNA], [], []],
  ["Doctor's companion + a Doctor who isn't a Time Lord: Donna Noble + Doctor Strange", [DNA, STR], [], [no(DNA, "Doctor's companion", STR, "no pairing ability", DOC)]],
  ["Doctor's companion + a Time Lord who isn't a Doctor: Donna Noble + The Rani", [DNA, RANI], [], [no(DNA, "Doctor's companion", RANI, "no pairing ability", DOC)]],
  ["A Time Lord companion + a Time Lord Doctor: Romana II + The Tenth Doctor", [ROM, TEN], [], []],
  ["Two Doctor's companions, one of them a Time Lord: Donna Noble + Romana II", [DNA, ROM], [], [no(DNA, "Doctor's companion", ROM, "Doctor's companion", DOC)]],
  ["Doctor's companion + plain Partner: Donna Noble + Tymna", [DNA, TY], [], [no(DNA, "Doctor's companion", TY, "Partner", DOC)]],
  ["Two Doctor's companions: Donna Noble + Amy Pond", [DNA, AMY], [], [no(DNA, "Doctor's companion", AMY, "Partner with " + RORY + ", Doctor's companion", PW + " " + DOC)]],
  ["Two abilities, Partner with used: Amy Pond + Rory Williams", [AMY, RORY], [], []],
  ["Two abilities, Doctor's companion used: Amy Pond + The Tenth Doctor", [AMY, TEN], [], []],
  ["Two abilities, neither matches: Amy Pond + Tymna", [AMY, TY], [], [no(AMY, "Partner with " + RORY + ", Doctor's companion", TY, "Partner", PW + " " + DOC)]],
  ["Amy's companion ability doesn't carry over to Rory: Rory Williams + The Tenth Doctor", [RORY, TEN], [], [no(RORY, "Partner with " + AMY, TEN, "a Time Lord Doctor", PW + " " + DOC)]],
  ["A single commander: Atraxa", [ATX], [], []],
  ["Two commanders, no pairing ability: Atraxa + Krenko", [ATX, KRE], [], [no(ATX, "no pairing ability", KRE, "no pairing ability", NONE)]],
  ["Plain Partner + no pairing ability: Tymna + Atraxa", [TY, ATX], [], [no(TY, "Partner", ATX, "no pairing ability", NONE)]],
  ["Names sharing a word aren't the same card: Brallin + Shabraz (both 'Skyshark')", [BRA, SHA], [], []],
  ["Legal pair, a card inside the combined colors: Tymna + Thrasios + Birds of Paradise", [TY, TH], ["Birds of Paradise"], []],
  ["Legal pair, a card outside the combined colors: Tymna + Thrasios + Lightning Bolt", [TY, TH], ["Lightning Bolt"], [CI1]],
  ["Illegal pair and a card outside the colors are reported separately: Pir + Tymna + Lightning Bolt", [PIR, TY], ["Lightning Bolt"], [no(PIR, "Partner with " + TOO, TY, "Partner", PW), CI1]],
];
const VARIANTS = [[SOP, OTH, "Friends forever"], [DON, RAP, "Character select"], [ELL, JOE, "Survivors"], [KRA, ATR, "Father & son"]];

// commander-related issues only: deck size and card legality aren't what this file is about
const mine = issues => issues.filter(i => !/^Commander decks need exactly 100 cards|^Commander has no sideboard|too many copies\.$|isn't legal in|aren't legal in/.test(i));
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function page(b, opts) {
  const p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|bad HTTP response code/.test(m.text())) errs.push(m.text()); });      // the mocked 404s aren't errors
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route(u => /^https:/.test(u.href) && u.hostname !== "cards.scryfall.io", r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.includes("api.scryfall.com/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers;
      return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: ids.map(i => BY[i.name]).filter(Boolean), not_found: [] }) }); }
    return r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8913/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(BY => { window.__BY = BY;
    // a Commander deck built the way the app builds one: each card through slim() and addToDeck(), commanders chosen by key
    window.__deck = (id, cmdrs, extra = [], fill) => { const d = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
      for (const n of cmdrs) { addToDeck(d, slim(__BY[n]), 1, false, true); d.cmdr.push(__BY[n].id + "|0"); }
      for (const n of extra) addToDeck(d, slim(__BY[n]), 1, false, true);
      if (fill) addToDeck(d, slim(__BY[fill]), 100 - Object.values(d.cards).reduce((a, c) => a + c.qty, 0), false, true);
      return d; };
    window.__check = d => { const ck = checkDeck(d); return { issues: ck.issues, flags: Object.entries(ck.flags).map(([k, v]) => d.cards[k].name + ": " + v.join("; ")) }; };
  }, BY);
  return { p, errs };
}

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8913", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch();
  try {
    const { p, errs } = await page(b, { viewport: { width: 1280, height: 900 } });

    // 1. the real-card matrix
    const R = await p.evaluate(M => M.map(([label, cm, extra]) => __check(__deck("m", cm, extra))), MATRIX);
    MATRIX.forEach(([label, , , want], i) => ok(same(mine(R[i].issues), want), `${label}: ${want.length ? want.join(" | ") : "no commander issues"}` + (same(mine(R[i].issues), want) ? "" : ` — got: ${JSON.stringify(mine(R[i].issues))}`)));
    const bolt = R[MATRIX.findIndex(m => /outside the combined/.test(m[0]))];
    ok(same(bolt.flags, ["Lightning Bolt: Outside your commander's colors"]), "the card outside the colors is the one marked (Lightning Bolt)");
    const birds = R[MATRIX.findIndex(m => /reported separately/.test(m[0]))];
    ok(same(birds.flags, ["Lightning Bolt: Outside your commander's colors"]), "an illegal pair still uses both commanders' colors for the color check (Lightning Bolt is outside Pir + Tymna)");

    // 2. each Partner— ability pairs only with its own
    const V = await p.evaluate(V => { const out = [];
      for (const [a, a2, va] of V) for (const [b, b2, vb] of V) out.push({ a, b: va === vb ? a2 : b, va, vb, issues: __check(__deck("v", [a, va === vb ? a2 : b])).issues });
      for (const [a, , va] of V) out.push({ a, b: "Tymna the Weaver", va, vb: null, issues: __check(__deck("v", [a, "Tymna the Weaver"])).issues });
      return out; }, VARIANTS);
    for (const v of V) {
      const want = v.va === v.vb ? [] : [no(v.a, "Partner—" + v.va, v.b, v.vb ? "Partner—" + v.vb : "Partner", VAR)];
      ok(same(mine(v.issues), want), `Partner—${v.va} with ${v.vb ? "Partner—" + v.vb : "plain Partner"} (${v.a} + ${v.b}): ${want.length ? "rejected" : "allowed"}` + (same(mine(v.issues), want) ? "" : ` — got: ${JSON.stringify(mine(v.issues))}`));
    }

    // 3. Background eligibility: no non-legendary Background exists in the Oracle data, so this one is Guild Artisan with
    //    "Legendary" taken off its type line (a modified copy of a real card, named so it can't be mistaken for it)
    const NL = "Guild Artisan (non-legendary copy)";
    const bg = await p.evaluate(NL => { __BY[NL] = Object.assign({}, __BY["Guild Artisan"], { id: "nonlegendary-guild-artisan", oracle_id: "nonlegendary-guild-artisan", name: NL, type_line: "Enchantment — Background" });
      return { with: __check(__deck("b", ["Wilson, Refined Grizzly", NL])).issues, alone: __check(__deck("b", [NL])).issues,
        legal: (() => { const d = __deck("b", ["Wilson, Refined Grizzly", "Guild Artisan"], [], "Forest"); return checkDeck(d).issues; })() }; }, NL);
    ok(same(mine(bg.with), [CANT(NL), no(WIL, "Choose a Background", NL, "no pairing ability", BG)]), "a non-legendary Background doesn't qualify for Choose a Background" + (same(mine(bg.with), [CANT(NL), no(WIL, "Choose a Background", NL, "no pairing ability", BG)]) ? "" : ` — got: ${JSON.stringify(mine(bg.with))}`));
    ok(same(mine(bg.alone), [CANT(NL)]), "a non-legendary Background alone can't be a commander");
    ok(bg.legal.length === 0, `Wilson + Guild Artisan in a full 100-card deck has no problems at all${bg.legal.length ? " — got: " + JSON.stringify(bg.legal) : ""}`);

    // 4. decks saved before Deckhand kept rules text: the pairing is reported as unverified, never certified or ruled out on a guess
    const NV = (A, B, why) => `Couldn't verify that ${A} and ${B} can be commanders together: ${why}`;
    const L = await p.evaluate(() => { const old = (d, ...names) => { for (const c of Object.values(d.cards)) if (names.includes(c.name)) delete c.text; return d; };
      const oldest = (d, n) => { const c = Object.values(d.cards).find(c => c.name === n); delete c.text; delete c.partner; return d; };
      return {
        one: __check(old(__deck("l", ["Tymna the Weaver", "Thrasios, Triton Hero"]), "Tymna the Weaver")).issues,
        both: __check(old(__deck("l", ["Tymna the Weaver", "Thrasios, Triton Hero"]), "Tymna the Weaver", "Thrasios, Triton Hero")).issues,
        pw: __check(old(__deck("l", ["Pir, Imaginative Rascal", "Tymna the Weaver"]), "Pir, Imaginative Rascal")).issues,
        cab: __check(old(__deck("l", ["Wilson, Refined Grizzly", "Guild Artisan"]), "Wilson, Refined Grizzly")).issues,
        noFlag: __check(oldest(__deck("l", ["Tymna the Weaver", "Thrasios, Triton Hero"]), "Tymna the Weaver")).issues,
        bgOld: __check(old(__deck("l", ["Wilson, Refined Grizzly", "Guild Artisan"]), "Guild Artisan")).issues,
        docOld: __check(old(__deck("l", ["Donna Noble", "The Tenth Doctor"]), "The Tenth Doctor")).issues,
        noAbility: __check(old(__deck("l", ["Tymna the Weaver", "Atraxa, Praetors' Voice"]), "Tymna the Weaver")).issues,
        flagFalse: __check(old(__deck("l", ["Krenko, Mob Boss", "Tymna the Weaver"]), "Krenko, Mob Boss")).issues,
        single: __check(old(__deck("l", ["Atraxa, Praetors' Voice"], [], "Forest"), "Atraxa, Praetors' Voice")).issues,
        singleP: __check(old(__deck("l", ["Tymna the Weaver"]), "Tymna the Weaver")).issues,
        oldCard: __check(old(__deck("l", ["Tymna the Weaver", "Thrasios, Triton Hero"], ["Sol Ring"]), "Sol Ring")).issues,
      }; });
    const LW = {
      one: [NV(TY, TH, `${TY}'s rules text wasn't saved with this deck.`)], both: [NV(TY, TH, "neither card's rules text was saved with this deck.")],
      pw: [NV(PIR, TY, `${PIR}'s rules text wasn't saved with this deck.`)], cab: [NV(WIL, GA, `${WIL}'s rules text wasn't saved with this deck.`)],
      noFlag: [NV(TY, TH, `${TY}'s rules text wasn't saved with this deck.`)],
      bgOld: [], docOld: [],
      noAbility: [no(TY, "rules text not saved", ATX, "no pairing ability", NONE)], flagFalse: [no(KRE, "no pairing ability", TY, "Partner", NONE)],
      single: [], singleP: [], oldCard: [] };
    const LL = { one: "one partner saved without its text: unverified, not legal and not illegal", both: "both partners saved without text: unverified",
      pw: "an old Pir (Partner with Toothy) next to Tymna: unverified rather than certified by the old yes/no flag", cab: "an old Wilson (Choose a Background) + Guild Artisan: unverified",
      noFlag: "a card saved before the partner flag existed: still unverified, not rejected", bgOld: "an old Background is still recognised from its type line: Wilson + Guild Artisan is legal",
      docOld: "an old Time Lord Doctor is still recognised from its type line: Donna Noble + The Tenth Doctor is legal",
      noAbility: "an old Tymna + Atraxa: ruled out, because Atraxa's saved text shows no pairing ability", flagFalse: "an old Krenko whose saved flag says no partner ability: ruled out as before",
      single: "a single commander saved without text, in a full deck: no problems", singleP: "a single Partner commander saved without text: no pairing message",
      oldCard: "an ordinary card saved without text doesn't affect a legal pair" };
    for (const k in LW) ok(same(mine(L[k]), LW[k]), `older deck: ${LL[k]}` + (same(mine(L[k]), LW[k]) ? "" : ` — got: ${JSON.stringify(mine(L[k]))}`));
    ok(!/couldn't verify/i.test(JSON.stringify(L.single.concat(L.singleP))), "an unverified-pairing message never appears for a single commander");

    // 5. the same commander twice, including under different keys (another printing, the sideboard key)
    const D = await p.evaluate(() => { const T = __BY["Tymna the Weaver"];
      const sameKey = __deck("d", ["Tymna the Weaver"]); sameKey.cmdr.push(sameKey.cmdr[0]);
      const print2 = __deck("d", ["Tymna the Weaver"]); const s2 = slim(Object.assign({}, T, { id: "tymna-other-printing", set: "cmr", collector_number: "999" })); addToDeck(print2, s2, 1, false, true); print2.cmdr.push(s2.id + "|0");
      const side = __deck("d", ["Tymna the Weaver"]); addToDeck(side, slim(T), 1, true, true); side.cmdr.push(T.id + "|1");
      const noOid = __deck("d", ["Tymna the Weaver"]); const s3 = slim(Object.assign({}, T, { id: "tymna-no-oid", oracle_id: "" })); addToDeck(noOid, s3, 1, false, true); noOid.cmdr.push(s3.id + "|0"); for (const c of Object.values(noOid.cards)) c.oid = "";
      const bgTwice = __deck("d", ["Guild Artisan"]); bgTwice.cmdr.push(bgTwice.cmdr[0]);
      return { sameKey: __check(sameKey).issues, print2: __check(print2).issues, side: __check(side).issues, noOid: __check(noOid).issues, bgTwice: __check(bgTwice).issues }; });
    ok(same(mine(D.sameKey), [DUP(TY)]), "the same commander chosen twice is rejected with a clear message");
    ok(same(mine(D.print2), [DUP(TY)]) && D.print2.includes("1 card has too many copies."), "the same commander in two printings is caught (same card, different key), and the copy-limit check still reports it too");
    ok(same(mine(D.side), [DUP(TY)]) && D.side.some(i => /^Commander has no sideboard/.test(i)), "the same commander under its sideboard key is caught, and the sideboard message is unchanged");
    ok(same(mine(D.noOid), [DUP(TY)]), "the same commander is caught by name when the saved cards have no Oracle id");
    ok(same(mine(D.bgTwice), [CANT(GA), DUP(GA)]), "a Background chosen twice: still can't be a commander, and the duplicate is named" + (same(mine(D.bgTwice), [CANT(GA), DUP(GA)]) ? "" : ` — got: ${JSON.stringify(D.bgTwice)}`));

    // 6. paste import (deck screen → Import list): what was marked as commander is checked the same way as a deck built by hand
    const paste = async (id, cmdrs) => { await p.evaluate(id => { S.decks[id] = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("decks", id); }, id);
      await p.waitForTimeout(300); await p.click("#dMenu"); await p.waitForSelector("#pl");
      await p.fill("#pl", "Commander\n" + cmdrs.map(n => "1 " + n).join("\n") + "\n\nDeck\n1 Sol Ring");
      await p.click("#plGo"); await p.waitForFunction(() => /added/i.test((document.querySelector("#plMsg") || {}).textContent || ""), null, { timeout: 8000 });
      const r = await p.evaluate(id => { const d = S.decks[id]; return { cmdr: d.cmdr.map(k => d.cards[k] && d.cards[k].name), ...__check(d) }; }, id); await p.evaluate(() => closeSheet()); return r; };
    const pv = await paste("pv", [PIR, TOO]), pi = await paste("pi", [PIR, TY]), pb = await paste("pb", [WIL, GA]);
    ok(same(pv.cmdr, [PIR, TOO]) && same(mine(pv.issues), []), "paste import, valid pair (Pir + Toothy): both become commanders, no commander issues");
    ok(same(pi.cmdr, [PIR, TY]) && same(mine(pi.issues), [no(PIR, "Partner with " + TOO, TY, "Partner", PW)]), "paste import, invalid pair (Pir + Tymna): the pairing is reported" + (same(mine(pi.issues), [no(PIR, "Partner with " + TOO, TY, "Partner", PW)]) ? "" : ` — got: ${JSON.stringify(mine(pi.issues))}`));
    ok(same(pb.cmdr, [WIL, GA]) && same(mine(pb.issues), []), "paste import, Choose a Background (Wilson + Guild Artisan): accepted, no can't-be-a-commander message");

    // 7. file import (CSV), through the import sheet
    const csv = async (name, cmdrs) => { await p.evaluate(([name, text]) => csvImport({ name, text: async () => text }, { kind: "deck", id: "__new" }),
        [name + ".csv", "Quantity,Name,Board\n" + cmdrs.map(n => `1,"${n}",commander`).join("\n") + "\n1,Sol Ring,main\n"]);
      await p.waitForSelector("#impGo"); await p.click("#impGo");
      await p.waitForFunction(() => !document.querySelector("#impBody") || document.querySelector("#impDone"), null, { timeout: 8000 }); await p.waitForTimeout(200);
      const r = await p.evaluate(name => { const d = Object.values(S.decks).find(x => x.name === name); return d ? { format: d.format, cmdr: d.cmdr.map(k => d.cards[k] && d.cards[k].name), ...__check(d) } : null; }, name);
      if (await p.$("#impDone")) await p.click("#impDone"); await p.evaluate(() => closeSheet()); await p.waitForTimeout(150); return r; };
    const cv = await csv("csvok", [SOP, OTH]), ci = await csv("csvbad", [SOP, TY]);
    ok(cv && cv.format === "commander" && same(cv.cmdr, [SOP, OTH]) && same(mine(cv.issues), []), "CSV import, valid pair (Sophina + Othelm): both become commanders, no commander issues" + (cv ? "" : " — no deck made"));
    ok(ci && same(ci.cmdr, [SOP, TY]) && same(mine(ci.issues), [no(SOP, "Partner—Friends forever", TY, "Partner", VAR)]), "CSV import, invalid pair (Sophina + Tymna): the pairing is reported" + (ci && !same(mine(ci.issues), [no(SOP, "Partner—Friends forever", TY, "Partner", VAR)]) ? ` — got: ${JSON.stringify(mine(ci.issues))}` : ""));
    ok(!errs.length, "no errors" + (errs.length ? ": " + errs[0] : ""));
    await p.context().close();

    // 8. the deck screen, at computer and phone width: a legal pair shows Legal, an illegal one lists the reason
    for (const [opts, label] of [[{ viewport: { width: 1280, height: 900 } }, "computer"], [{ ...devices["Pixel 7"] }, "phone"]]) {
      const { p, errs } = await page(b, opts);
      const show = async (id, cm, fill) => { await p.evaluate(([id, cm, fill]) => { S.meta.deckIssuesOpen = true; S.decks[id] = __deck(id, cm, [], fill); save(); go("decks", id); }, [id, cm, fill]); await p.waitForTimeout(400);
        return p.evaluate(() => ({ chip: ((document.querySelector("#dFmtBox .chip") || {}).textContent || "").trim(), list: [...document.querySelectorAll("#dIssueList li")].map(l => l.textContent),
          over: document.documentElement.scrollWidth > innerWidth + 1 })); };
      const g = await show("ok", [WIL, GA], "Forest"), x = await show("bad", [PIR, TY], "Forest"), t = await show("tt", [TY, TH], "Forest");
      ok(/Legal/.test(g.chip) && !g.list.length, `${label}: Wilson + Guild Artisan shows Legal (it used to say Guild Artisan can't be a commander)`);
      ok(/1 problem/.test(x.chip) && same(x.list, [no(PIR, "Partner with " + TOO, TY, "Partner", PW)]), `${label}: Pir + Tymna shows 1 problem, with the reason` + (same(x.list, [no(PIR, "Partner with " + TOO, TY, "Partner", PW)]) ? "" : ` — got: ${JSON.stringify(x)}`));
      ok(/Legal/.test(t.chip), `${label}: Tymna + Thrasios still shows Legal`);
      ok(!g.over && !x.over && !t.over, `${label}: nothing runs off the side of the screen`);
      ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : ""));
      await p.context().close();
    }
  } finally { await b.close(); srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
