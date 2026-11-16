// Deck → Balance → Deck analysis: what a deck holds, where it may be thin, and which owned cards could help.
// EDHREC and Scryfall are pretend here (routes below); nothing in this file talks to the real services.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (name, type, cmc, text, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: type, cmc, mana_cost: cmc ? `{${cmc}}` : "", colors: ["R"], color_identity: ["R"],
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" }, oracle_text: text || "", keywords: [] }, o);
const pad = i => String(i).padStart(2, "0"), seq = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1)), NOC = { colors: [], color_identity: [] };
const gobMv = i => i <= 10 ? 1 : i <= 20 ? 2 : i <= 26 ? 3 : i <= 30 ? 4 : 6;
const hfMv = i => i <= 8 ? 1 : i <= 16 ? 2 : i <= 21 ? 3 : i <= 29 ? 4 : i <= 31 ? 5 : 6;
const CARDS = [
  C("Krenko, Mob Boss", "Legendary Creature — Goblin Warrior", 4, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control."),
  C("Magda, Mana Boss", "Legendary Creature — Goblin Shaman", 3, "{T}: Add {R}{R}.", { produced_mana: ["R"] }),
  C("Zada, Hedron Grinder", "Legendary Creature — Goblin Ally", 4, ""),
  C("Mountain", "Basic Land — Mountain", 0, "({T}: Add {R}.)", { produced_mana: ["R"], colors: [] }),
  // ramp
  C("Sol Ring", "Artifact", 1, "{T}: Add {C}{C}.", { produced_mana: ["C"], ...NOC }), C("Arcane Signet", "Artifact", 2, "{T}: Add one mana of any color in your commander's color identity.", { produced_mana: ["W", "U", "B", "R", "G"], ...NOC }),
  C("Mind Stone", "Artifact", 2, "{T}: Add {C}.\n{1}, {T}, Sacrifice Mind Stone: Draw a card.", { produced_mana: ["C"], ...NOC }), C("Hedron Archive", "Artifact", 4, "{T}: Add {C}{C}.", { produced_mana: ["C"], ...NOC }),
  C("Mana Goblin", "Creature — Goblin Druid", 2, "{T}: Add {R}.", { produced_mana: ["R"] }), C("Desperate Ritual", "Instant — Arcane", 2, "Add {R}{R}{R}.", { produced_mana: ["R"] }),
  // card draw, selection, tutor
  C("Fire Archive", "Enchantment", 3, "At the beginning of your upkeep, you draw a card."), C("Quick Study", "Instant", 3, "Draw two cards."), C("Faithless Looting", "Sorcery", 1, "Draw two cards, then discard two cards."),
  C("Gamble Draw", "Sorcery", 2, "Draw a card if you control a Goblin."), C("Crystal Ball", "Artifact", 3, "{1}, {T}: Scry 2.", { keywords: ["Scry"], ...NOC }), C("Gamble", "Sorcery", 1, "Search your library for a card, put that card into your hand, then discard a card at random."),
  // removal and wipes
  C("Lightning Bolt", "Instant", 1, "Lightning Bolt deals 3 damage to any target."), ...seq(6, i => C("Zap " + i, "Instant", 2, `Zap ${i} deals 3 damage to target creature.`)), C("Goblin Sniper", "Creature — Goblin", 3, "{T}: Goblin Sniper deals 1 damage to target creature."),
  C("Blasphemous Act", "Sorcery", 9, "Blasphemous Act deals 13 damage to each creature."), C("Evacuation", "Instant", 5, "Return all creatures to their owners' hands."),
  // protection, recursion
  C("Lightning Greaves", "Artifact — Equipment", 2, "Equipped creature has haste and shroud.\nEquip {0}", NOC), C("Goblin Recall", "Sorcery", 2, "Return target creature card from your graveyard to your hand."), C("Raise the Goblins", "Sorcery", 5, "Return all creature cards from your graveyard to the battlefield."),
  ...seq(33, i => C("Goblin " + pad(i), "Creature — Goblin", gobMv(i), "")), ...seq(4, i => C("Odd " + i, "Artifact", 4, "", NOC)),
  // the collection: cards that could fill the gaps
  C("Ruby Stone", "Artifact", 2, "{T}: Add {R}.", { produced_mana: ["R"] }), C("Fire Diamond", "Artifact", 2, "{T}: Add {R}.", { produced_mana: ["R"], edhrec_rank: 500 }), C("Ember Rock", "Artifact", 2, "{T}: Add {R}.", { produced_mana: ["R"], edhrec_rank: 700 }),
  C("Big Rock", "Artifact", 5, "{T}: Add {C}{C}{C}.", { produced_mana: ["C"], edhrec_rank: 900, ...NOC }), C("Rite of Flame", "Sorcery", 1, "Add {R}{R}.", { produced_mana: ["R"], edhrec_rank: 10 }),
  C("Green Growth", "Sorcery", 2, "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", { colors: ["G"], color_identity: ["G"], edhrec_rank: 5 }),
  C("Banned Rock", "Artifact", 2, "{T}: Add {C}{C}.", { produced_mana: ["C"], edhrec_rank: 1, legalities: { commander: "banned", modern: "legal" }, ...NOC }),
  C("Wish Rock", "Artifact", 2, "{T}: Add {C}.", { produced_mana: ["C"], ...NOC }), C("Top Rock", "Artifact", 3, "{T}: Add {C}.", { produced_mana: ["C"], ...NOC }),
  C("Card Engine", "Enchantment", 3, "Whenever a Goblin enters the battlefield under your control, draw a card."), C("Sip", "Instant", 2, "Draw two cards."),
  C("Goblin Bunker", "Enchantment", 2, "Creatures you control have indestructible."), C("Commander's Shield", "Artifact", 1, "Commander creatures you control have hexproof.", NOC), C("Blue Ward", "Instant", 1, "Target creature you control gains hexproof until end of turn.", { colors: ["U"], color_identity: ["U"] }),
  C("Vandalblast", "Sorcery", 1, "Destroy target artifact you don't control."), C("Universal Answer", "Artifact", 4, "{T}, Sacrifice Universal Answer: Destroy target permanent.", NOC), C("Shock", "Instant", 1, "Shock deals 2 damage to any target."),
  C("Shattering Goblin", "Creature — Goblin", 2, "When Shattering Goblin enters the battlefield, destroy target artifact."), C("Plain Thing", "Artifact", 3, "", NOC), C("Goblin Lair", "Land", 0, "{T}: Add {R}.", { produced_mana: ["R"], colors: [] }),
  ...seq(40, i => C("Fill " + pad(i), "Creature — Goblin", 3, "")),
  // the healthy deck
  ...seq(10, i => C("Rock " + pad(i), "Artifact", 2, "{T}: Add {C}.", { produced_mana: ["C"], ...NOC })), ...seq(9, i => C("Draw " + pad(i), "Instant", 3, "Draw two cards.")), ...seq(7, i => C("Answer " + pad(i), "Sorcery", 3, "Destroy target permanent.")),
  ...seq(2, i => C("Wipe " + pad(i), "Sorcery", 5, "Destroy all creatures.")), ...seq(2, i => C("Shield " + pad(i), "Instant", 1, "Permanents you control gain indestructible until end of turn.")), ...seq(33, i => C("Hf " + pad(i), "Creature — Goblin", hfMv(i), "")),
  // for the checks run directly on the analysis
  ...seq(9, i => C("Slow Rock " + i, "Artifact", 4, "{T}: Add {C}.", { produced_mana: ["C"], ...NOC })), C("Negate", "Instant", 2, "Counter target noncreature spell.", { colors: ["U"], color_identity: ["U"] }), ...seq(20, i => C("Giant " + pad(i), "Creature — Giant", 7, "")), ...seq(20, i => C("Mid " + pad(i), "Creature — Ogre", 4, "")),
];
const view = (n, num, pot, syn) => ({ name: n, sanitized: n.toLowerCase(), num_decks: num, potential_decks: pot, synergy: syn });
const page = lists => ({ container: { json_dict: { cardlists: lists } }, panels: { taglinks: [] } });
// Krenko's page: Goblin 01–12 on top, then four cards that fill gaps, then 40 fillers; Sol Ring and Lightning Bolt far down; two lands
const KR = [...seq(12, i => view("Goblin " + pad(i), 30000 - i * 100, 50000, 0.9 - i * 0.01)), view("Ruby Stone", 20500, 50000, 0.5), view("Top Rock", 9000, 50000, 0.45), view("Wish Rock", 8000, 50000, 0.44), view("Shattering Goblin", 7000, 50000, 0.43),
  ...seq(40, i => view("Fill " + pad(i), 5000 - i * 10, 50000, 0.3 - i * 0.001)), view("Lightning Bolt", 25000, 50000, 0.01), view("Sol Ring", 45000, 50000, -0.05)];
const EDH = {
  "commanders/krenko-mob-boss": page([{ header: "High Synergy Cards", tag: "highsynergycards", cardviews: KR }, { header: "Lands", tag: "lands", cardviews: [view("Mountain", 49000, 50000, 0), view("Goblin Lair", 30000, 50000, 0.1)] }]),
  "tags/goblins": page([{ header: "Top Cards", tag: "topcards", cardviews: [...seq(5, i => view("Goblin " + pad(i), 900, 1000, 0.2)), view("Card Engine", 800, 1000, 0.3), view("Mana Goblin", 700, 1000, 0.1)] }]),
};
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], failed = [], M = { edhDown: false, sfDown: false };
  p.on("pageerror", e => errs.push(e.message)); p.on("requestfailed", r => { if ((/edhrec/.test(r.url()) && !M.edhDown) || (/scryfall/.test(r.url()) && !M.sfDown)) failed.push(r.url()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://json.edhrec.com/**", r => { const k = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); if (M.edhDown) return r.abort("failed"); const v = EDH[k];
    return v === undefined ? r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }) : r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(v) }); });
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/collection")) { if (M.sfDown) return r.abort("failed"); const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(i => CARDS.find(c => c.name === i.name || c.id === i.id)).filter(Boolean), not_found: [] }); }
    return J({ data: [] }, u.includes("/cards/search") ? 200 : 404); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8905/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(CARDS => {
    const by = window.BY = Object.fromEntries(CARDS.map(c => [c.name, c])); S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    const pad = i => String(i).padStart(2, "0"), own = (n, q = 1, bin = "main") => addToColl(slim(by[n]), "nonfoil", q, bin, true);
    ["Ruby Stone", "Fire Diamond", "Ember Rock", "Big Rock", "Rite of Flame", "Green Growth", "Banned Rock", "Card Engine", "Sip", "Goblin Bunker", "Commander's Shield", "Blue Ward", "Vandalblast", "Universal Answer", "Shock", "Plain Thing"].forEach(n => own(n));
    own("Fire Diamond", 2); own("Wish Rock", 3, "wish");                                   // three Fire Diamonds in all; Wish Rock only on the wishlist
    const deck = window.mkDeck = (id, name, format, cmdr, t) => { const d = { id, name, format, cmdr: [], cards: {}, created: 1, updated: t }; if (id) S.decks[id] = d; if (cmdr) { addToDeck(d, by[cmdr], 1, false, true); d.cmdr = [Object.keys(d.cards)[0]]; } return d; };
    const put = window.put = (d, names, q = 1, side = false) => names.forEach(n => addToDeck(d, by[n], q, side, true));
    const g = deck("g", "Goblins!", "commander", "Krenko, Mob Boss", 9); g.themes = ["Goblins"];
    put(g, ["Mountain"], 36); put(g, ["Sol Ring", "Arcane Signet", "Mind Stone", "Hedron Archive", "Mana Goblin", "Desperate Ritual", "Fire Archive", "Quick Study", "Faithless Looting", "Gamble Draw", "Crystal Ball", "Gamble", "Lightning Bolt", "Goblin Sniper", "Blasphemous Act", "Evacuation", "Lightning Greaves", "Goblin Recall", "Raise the Goblins"]);
    put(g, ["Zap 1"], 2); put(g, [2, 3, 4, 5, 6].map(i => "Zap " + i)); put(g, Array.from({ length: 33 }, (_, i) => "Goblin " + pad(i + 1))); put(g, [1, 2, 3, 4].map(i => "Odd " + i)); put(g, ["Plain Thing"], 1, true);      // one card in the sideboard
    const h = deck("h", "Healthy", "commander", "Magda, Mana Boss", 8); put(h, ["Mountain"], 36);
    for (const [n, k] of [["Rock", 10], ["Draw", 9], ["Answer", 7], ["Wipe", 2], ["Shield", 2], ["Hf", 33]]) put(h, Array.from({ length: k }, (_, i) => n + " " + pad(i + 1)));
    const n = deck("n", "No commander yet", "commander", null, 7); put(n, ["Sol Ring", "Quick Study", "Goblin 01"]); n.cards["mystery|0"] = { id: "mystery", name: "Mystery Card", qty: 1, side: false };      // a card with nothing saved, that Scryfall doesn't know
    deck("e", "Empty", "commander", "Zada, Hedron Grinder", 6); S.decks.e.cards = {}; S.decks.e.cmdr = [];
    const c = deck("c", "Casual pile", "casual", null, 5); put(c, ["Mountain"], 16); put(c, Array.from({ length: 24 }, (_, i) => "Goblin " + pad(i + 1)));
    save();
  }, CARDS);
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
  const openOp = async id => { await p.evaluate(id => { deckTab[id] = "balance"; balMode[id] = "optimize"; go("decks", id); }, id); await p.waitForSelector("#bMode"); };
  const openAll = () => p.$$eval("#op details", a => a.forEach(d => { d.open = true; }));
  const inSec = s => p.$$eval(`#op-${s} .op-card`, a => a.map(x => x.dataset.name));
  const cardT = (s, name) => p.$eval(`#op-${s} .op-card[data-name="${name}"]`, e => e.textContent.replace(/\s+/g, " ").trim());
  const recs = (w, g) => p.$$eval(`#opw-${w} .op-${g} .item`, a => a.map(x => x.dataset.name));
  const recT = (w, name) => p.$eval(`#opw-${w} .item[data-name="${name}"]`, e => e.textContent.replace(/\s+/g, " ").trim());
  const weak = () => p.$$eval("#opWeak details.op-weak", a => a.map(x => x.id.replace(/^opw-/, "")));
  const num = async sel => +(await txt(sel));
  const fits = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // ---- where it lives: a second view of the Balance tab; the role table stays the default (32)
  await p.evaluate(() => { deckTab.g = "balance"; go("decks", "g"); }); await p.waitForSelector("#bMode");
  ok(await p.$eval('#bMode [data-b="roles"]', e => e.getAttribute("aria-pressed") === "true") && !(await p.$("#op")) && await p.$$eval(".baltable .balrow", a => a.length) === 11, `${label}: the Balance tab still opens on its role table; Deck analysis is a second view beside it`);
  await p.waitForTimeout(700); const coll0 = await p.evaluate(() => JSON.stringify(S.coll)), keys0 = await p.evaluate(() => Object.keys(S.decks.g).sort().join()), skeys0 = await p.evaluate(() => Object.keys(S).sort().join());
  const balRamp = await p.$$eval(".baltable .balrow", a => Object.fromEntries(a.slice(1).map(r => [r.querySelector(".bn").textContent.trim().replace(/^\S+\s/, ""), +r.querySelector("b").textContent])));
  await p.click('#bMode [data-b="optimize"]'); await p.waitForSelector("#opSum");
  // ---- the health summary (3)
  ok(/^Krenko, Mob Boss · Commander · theme: Goblins$/.test(await txt("#opHead")), `${label}: the summary names the commander, the format and the theme (${await txt("#opHead")})`);
  ok(await num("#opTotal") === 100 && /^64 different cards, 100 with copies, in the main deck \(commander included\); the 1 sideboard card isn't counted\./.test(await txt("#opTotals")), `${label}: 100 cards analysed, 64 different ones; the sideboard is left out and said so (10)`);
  ok(await txt("#opAvg") === "2.62", `${label}: average mana value 165 / 63 = 2.62 (2) (${await txt("#opAvg")})`);
  ok(await num("#opNRamp") === 5 && await num("#opNDraw") === 5 && await num("#opNRem") === 9 && await num("#opNWipe") === 2 && await num("#opNProt") === 1 && await num("#opNLand") === 36, `${label}: ramp 5, card draw 5, removal 9, board wipes 2, protection 1, lands 36`);
  ok(balRamp["Card draw"] === 5 && balRamp.Removal === 9 && balRamp["Board wipe"] === 2 && balRamp.Protection === 1 && balRamp.Land === 36 && balRamp.Ramp === 6, `${label}: the same counts as the role table (which counts the one-time ritual as ramp: 6)`);
  ok(/1 card does more than one job and is counted once in each\./.test(await txt("#opTotals")), `${label}: it says how many cards do more than one job (9)`);
  const assess = await txt("#opAssess");
  ok(assess === "14 of your 62 nonland cards are among those played with Krenko, Mob Boss on EDHREC. Lands, removal and board wipes are at or above the usual range, but ramp (5), card draw (5) and protection (1) look light. Also worth a look: very little artifact or enchantment removal.", `${label}: one plain sentence of assessment, built from the counts (${assess})`);
  ok(!/\bscore\b|\/ ?100|\bgrade\b/i.test(await txt("#op")), `${label}: no score or grade anywhere`);
  // ---- weaknesses (18, 19)
  ok((await weak()).join() === "ramp,card-draw,protection,artifact-enchantment" && await num("#opWeakN") === 4, `${label}: four possible weaknesses: ramp, card draw, protection, artifact/enchantment removal; 38% of spells at two mana is not flagged (cheap plays are not a problem) (${await weak()})`);
  ok((await p.$$eval("#opHealthy .chip", a => a.map(x => x.textContent.trim()))).join(" | ") === "Land 36 · usual 35–38 | Removal 9 · usual 7–10 | Board wipe 2 · usual 2–4", `${label}: lands, removal and board wipes are inside their ranges and listed as healthy, not as weaknesses`);
  ok(await p.$eval("#opw-ramp", e => e.open) && !(await p.$eval("#opw-card-draw", e => e.open)), `${label}: the first weakness is open, the rest folded`);
  await openAll(); if (process.env.SHOTS) await p.screenshot({ path: `/tmp/opt_${label}.png`, fullPage: true });
  const wr = await txt("#opw-ramp");
  ok(/5 ramp cards; the suggested range is 9–12\. \(1 card that gives mana once is not counted\.\)/.test(wr) && /plays its bigger cards later/.test(wr) && /What would help: Add mana rocks/.test(wr), `${label}: a weakness gives the issue, the counts, why it matters and what would help`);
  ok(!/leans on it/.test(wr), `${label}: Krenko makes no mana, so nothing is said about leaning on the commander`);
  ok(/0 cards in the deck can remove an artifact or an enchantment\./.test(await txt("#opw-artifact-enchantment")), `${label}: the specific checks carry their own counts`);
  // ---- recommendations: owned first, then not owned (13–17)
  ok((await recs("ramp", "owned")).join() === "Ruby Stone,Fire Diamond,Ember Rock,Big Rock", `${label}: owned ramp, most played with the commander first, then by overall rank: ${await recs("ramp", "owned")} (14)`);
  ok(!(await recs("ramp", "owned")).includes("Green Growth"), `${label}: an owned ramp card outside the commander's colors is not offered (13)`);
  ok(!(await recs("ramp", "owned")).includes("Banned Rock"), `${label}: nor one that is banned in the format`);
  ok(!(await recs("ramp", "owned")).includes("Rite of Flame"), `${label}: nor a one-time ritual, which isn't counted as ramp`);
  ok(!(await recs("ramp", "owned")).includes("Wish Rock") && (await recs("ramp", "missing")).join() === "Top Rock,Wish Rock" && /Not owned.*On your wishlist/.test(await recT("ramp", "Wish Rock")), `${label}: a card that is only on the wishlist is not owned: it is under “don't own”, marked (15, 16)`);
  ok(!(await recs("ramp", "owned")).includes("Plain Thing") && !(await recs("card-draw", "owned")).includes("Plain Thing") && !(await recs("protection", "owned")).includes("Plain Thing"), `${label}: an owned card in the right colors with none of the roles is never offered`);
  ok(/A mana rock at mana value 2: an early ramp source\. In 41% of Krenko, Mob Boss decks on EDHREC\./.test(await recT("ramp", "Ruby Stone")) && /Owned ×1/.test(await recT("ramp", "Ruby Stone")), `${label}: each suggestion says why (${(await recT("ramp", "Ruby Stone")).slice(-110)}) (17)`);
  ok(/Owned ×3/.test(await recT("ramp", "Fire Diamond")) && /A mana rock at mana value 5\.$/.test((await recT("ramp", "Big Rock")).replace(/＋$/, "").trim()), `${label}: copies owned are shown; a five-mana rock isn't called early`);
  ok((await recs("card-draw", "owned")).join() === "Card Engine,Sip" && /Repeatable card draw\. Played more in Goblins decks than elsewhere \(EDHREC synergy \+30%\)\./.test(await recT("card-draw", "Card Engine")) && /Draws cards\./.test(await recT("card-draw", "Sip")), `${label}: owned card draw, the theme's card first, each with its kind`);
  ok((await recs("protection", "owned")).join() === "Commander's Shield,Goblin Bunker" && /Protects your commander \(hexproof\)/.test(await recT("protection", "Commander's Shield")) && /Protects your whole board \(indestructible\)/.test(await recT("protection", "Goblin Bunker")), `${label}: owned protection says whom it protects and how; the blue one is left out`);
  ok((await recs("artifact-enchantment", "owned")).join() === "Universal Answer,Vandalblast" && (await recs("artifact-enchantment", "missing")).join() === "Shattering Goblin", `${label}: for artifact/enchantment removal only cards that can hit one are offered (not Shock): ${await recs("artifact-enchantment", "owned")}`);
  ok(/Flexible removal: answers any kind of permanent/.test(await recT("artifact-enchantment", "Universal Answer")) && /Removes artifacts \/ enchantments\./.test(await recT("artifact-enchantment", "Vandalblast")) && /A Goblin, which your deck is built around/.test(await recT("artifact-enchantment", "Shattering Goblin")), `${label}: and they say what they remove`);
  ok(await p.$$eval("#op .op-missing [data-opadd]", a => a.length) === 0 && await p.$$eval("#op .op-owned [data-opadd]", a => a.length) === 10, `${label}: only owned cards have an Add button`);
  // ---- A. mana curve (1, 2)
  ok((await p.$$eval("#opCurve .op-bar", a => a.map(x => x.dataset.b + ":" + x.textContent.trim()))).join(" ") === "0–1:14 2:24 3:10 4:9 5:2 6+:4", `${label}: the curve: 0–1: 14, 2: 24, 3: 10, 4: 9, 5: 2, 6+: 4`);
  ok(await p.$$eval("#opCurve .op-bar", a => a.every(x => x.getBoundingClientRect().height >= 2) && a[1].getBoundingClientRect().height > a[4].getBoundingClientRect().height * 5), `${label}: drawn as bars whose heights follow the counts`);
  ok(/63 spells by mana value.*Average mana value 2\.62/.test(await txt("#op-curve")) && /Nothing unusual in the shape of the curve/.test(await txt("#opCurveSay")), `${label}: with the average and what stands out`);
  // ---- B. ramp (3)
  ok((await inSec("ramp")).join() === "Arcane Signet,Desperate Ritual,Hedron Archive,Mana Goblin,Mind Stone,Sol Ring", `${label}: the ramp cards are listed (${await inSec("ramp")})`);
  ok(await num("#opRampN b") === 5 && await num("#opBurstN b") === 1 && await num("#opEarlyN b") === 4 && await txt("#opRampMv") === "By mana value: 1: 1 · 2: 3 · 4+: 1", `${label}: 5 sources, 1 one-time, 4 that cost two or less, spread by mana value`);
  ok(/mana rock/.test(await cardT("ramp", "Sol Ring")) && /mana creature/.test(await cardT("ramp", "Mana Goblin")) && /one-time mana/.test(await cardT("ramp", "Desperate Ritual")), `${label}: each with its kind: rock, creature, one-time`);
  ok(/4 of them cost two or less, so ramp is there in the early turns\. The commander isn't a ramp source/.test(await txt("#opRampSay")), `${label}: it says whether ramp comes early and whether it depends on the commander`);
  // ---- C. card draw (4)
  ok((await inSec("draw")).slice(0, 5).join() === "Faithless Looting,Fire Archive,Gamble Draw,Mind Stone,Quick Study", `${label}: the card-draw cards (${(await inSec("draw")).slice(0, 5)})`);
  ok(await num("#opDrawDirect b") === 2 && await num("#opDrawRepeat b") === 1 && await num("#opDrawCond b") === 1 && await num("#opDrawLoot b") === 1, `${label}: direct 2, repeatable 1, conditional 1, filtering 1`);
  ok(await num("#opSelN b") === 1 && await num("#opTutN b") === 1 && !(await inSec("draw")).slice(0, 5).includes("Gamble") && (await inSec("draw")).includes("Crystal Ball") && (await inSec("draw")).includes("Gamble"), `${label}: selection (Crystal Ball) and the tutor (Gamble) are shown apart and not counted as draw`);
  ok(/also: card draw/.test(await cardT("ramp", "Mind Stone")) && /also: ramp/.test(await cardT("draw", "Mind Stone")), `${label}: a card with two roles is in both sections, each naming the other (9)`);
  // ---- D. removal (5), E. wipes and recovery (6, 8), F. protection (7)
  ok(await num("#opRemCreature b") === 9 && await num("#opRemAE b") === 0 && await num("#opRemPW b") === 1 && await num("#opRemFlex b") === 0 && await num("#opRemCounter b") === 0 && await num("#opRemWipes b") === 2, `${label}: creature removal 9 copies, artifact/enchantment 0, planeswalker 1, flexible 0, counterspells 0, wipes 2`);
  ok(/Removal and interaction 10 cards · 11 copies/.test(await txt("#op-removal summary")) && /×2/.test(await cardT("removal", "Zap 1")), `${label}: 10 different cards, 11 copies: unique cards and copies are told apart (10)`);
  ok(await num("#opWipeMass b") === 1 && await num("#opWipeReset b") === 1 && await num("#opWipeProt b") === 0 && await num("#opWipeRec b") === 2, `${label}: one mass removal, one board reset, no board protection, two recursion cards`);
  ok(/to the battlefield/.test(await cardT("wipes", "Raise the Goblins")) && /to your hand/.test(await cardT("wipes", "Goblin Recall")) && /With 35 creatures the deck relies on its board, and it has 2 recursion cards to keep or rebuild it\./.test(await txt("#opWipeSay")), `${label}: recursion by kind, and a sentence on how the deck stands against a wipe`);
  ok((await inSec("prot")).join() === "Lightning Greaves" && await num("#opProt-one b") === 1 && await num("#opProt-board b") === 0 && /one creature or permanent.*hexproof/.test(await cardT("prot", "Lightning Greaves")), `${label}: protection: whom it protects and how`);
  // ---- G. synergy and theme (11, 12)
  ok(await txt("#opSynCmd b") === "14 of 62" && await num("#opSynTop b") === 12 && await txt("#opSynTheme b") === "6 of 62" && await num("#opSynTribe b") === 36, `${label}: 14 cards on the commander's page (12 in its Top 50), 6 on the theme's list, 36 Goblin cards or cards that name them`);
  ok((await p.$$eval("#opNoLink .op-card", a => a.map(x => x.dataset.name))).join() === "Crystal Ball,Odd 1,Odd 2,Odd 3,Odd 4" && /It is not a list of cards to take out/.test(await txt("#opNoLink")), `${label}: cards with no link found are listed without calling them bad`);
  ok((await p.$$eval("#opSynOpp .item", a => a.map(x => x.dataset.name))).join() === "Ruby Stone" && /being on its lists means a card is played often, not that it is better/.test(await txt("#opSource")), `${label}: synergy you already own comes from the Top 50; popularity isn't treated as quality (21)`);
  // ---- unknown (20)
  ok(await p.$$eval("#op-unknown .op-card", a => a.length) === 38 && /would rather say it doesn't know than guess/.test(await txt("#op-unknown")), `${label}: 38 cards with no role identified are listed as such, not given one`);
  // ---- controls: fold, open a card (7)
  await p.$eval("#op-ramp", e => { e.open = false; }); await p.waitForTimeout(50); await p.evaluate(() => renderDeck(S.decks.g)); await p.waitForSelector("#opSum");
  ok(!(await p.$eval("#op-ramp", e => e.open)) && await p.$eval("#op-draw", e => e.open), `${label}: sections fold, and stay as you left them`);
  await p.click('#op-draw .op-card[data-name="Quick Study"]'); await p.waitForTimeout(300);
  ok(/Quick Study/.test(await txt("#sheetRoot")), `${label}: tapping a card opens its details`); await p.evaluate(() => closeSheet()); await p.waitForTimeout(200);
  // ---- adding an owned suggestion (26–28)
  const deckBefore = await p.evaluate(() => JSON.stringify(Object.entries(S.decks.g.cards).map(([k, c]) => k + ":" + c.qty)));
  await p.click('#opw-ramp .item[data-name="Ruby Stone"] [data-opadd]'); await p.waitForSelector('#opw-ramp .op-owned'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.values(S.decks.g.cards).filter(c => c.name === "Ruby Stone" && !c.side && c.qty === 1).length === 1), `${label}: ＋ adds one copy of the owned card to the main deck (26)`);
  ok(await num("#opNRamp") === 6 && await num("#opTotal") === 101 && /6 ramp cards; the suggested range is 9–12/.test(await txt("#opw-ramp")) && (await recs("ramp", "owned")).join() === "Fire Diamond,Ember Rock,Big Rock" && (await inSec("ramp")).includes("Ruby Stone"), `${label}: the counts and the suggestions update at once (27)`);
  ok(await txt("#opSynCmd b") === "15 of 63" && await num("#opSynTop b") === 13 && !(await p.$("#opSynOpp")), `${label}: and so does the synergy section`);
  ok(await p.evaluate(() => JSON.stringify(S.coll)) === coll0, `${label}: the collection is unchanged (28)`);
  ok(await p.evaluate(b => { const now = Object.entries(S.decks.g.cards).map(([k, c]) => k + ":" + c.qty), was = JSON.parse(b); return was.every(x => now.includes(x)) && now.length === was.length + 1; }, deckBefore), `${label}: nothing was removed or replaced in the deck: only the one card was added`);
  for (const n of ["Fire Diamond", "Ember Rock", "Big Rock"]) { await p.click(`#opw-ramp .item[data-name="${n}"] [data-opadd]`); await p.waitForTimeout(250); }
  await p.waitForSelector("#opSum");
  ok(await num("#opNRamp") === 9 && !(await weak()).includes("ramp") && !(await weak()).includes("early-ramp") && (await p.$$eval("#opHealthy .chip", a => a.map(x => x.dataset.h))).includes("Ramp"), `${label}: with nine ramp cards the weakness is gone and ramp is listed as healthy (${await weak()})`);
  ok(await p.evaluate(() => JSON.stringify(S.coll)) === coll0 && await p.evaluate(() => Object.keys(S.decks.g).sort().join()) === keys0 && await p.evaluate(() => Object.keys(S).sort().join()) === skeys0, `${label}: still no change to the collection, and nothing new is stored on the deck or in the app's data`);
  // ---- refresh
  await p.click("#opRefresh"); await p.waitForSelector("#opSum"); ok(await num("#opNRamp") === 9 && await txt("#opSynCmd b") === "15 of 66", `${label}: Refresh runs the analysis again`);
  // ---- a healthy deck: nothing is made up (19)
  await openOp("h"); await p.waitForSelector("#opSum");
  ok(await num("#opWeakN") === 0 && /None found\. Every counted role is at or above its suggested range/.test(await txt("#opNoWeak")) && await p.$$eval("#opHealthy .chip", a => a.length) === 6 && (await weak()).length === 0, `${label}: a deck inside every range gets no weaknesses, and is told so`);
  ok(/Nothing stands out as weak/.test(await txt("#opAssess")) && await p.$$eval("#op [data-opadd]", a => a.length) === 0, `${label}: and no suggestions are pushed at it`);
  ok(/EDHREC has no page for Magda, Mana Boss\..*commander-specific suggestions are unavailable/.test(await txt("#opNoEdh")), `${label}: a commander EDHREC doesn't know is said plainly`);
  await openAll();
  ok(/Your commander makes mana too\. With 10 other sources, the deck doesn't depend on it\./.test(await txt("#opRampSay")) && await num("#opRemFlex b") === 7 && await num("#opProt-board b") === 2 && await num("#opWipeProt b") === 2, `${label}: a commander that makes mana is noticed; flexible removal and board-wide protection are counted`);
  // ---- no commander, missing card data, an unfinished deck (23, 24)
  await openOp("n"); await p.waitForSelector("#opSum"); await openAll();
  ok(/^No commander · Commander · no theme chosen$/.test(await txt("#opHead")) && /has no commander yet/.test(await txt("#opNoCmd")) && /no commander to measure it against/.test(await txt("#opSynNo")), `${label}: a deck with no commander is analysed, and says what can't be said`);
  ok(/Not judged yet: the deck has 4 of 100 cards/.test(await txt("#opUnfinished")) && (await weak()).length === 0 && /too early to say what it lacks/.test(await txt("#opAssess")), `${label}: a deck that is far from finished gets no weaknesses`);
  ok((await p.$$eval("#opNoData .op-card", a => a.map(x => x.dataset.name))).join() === "Mystery Card" && await num("#opTotal") === 4 && await num("#opNRamp") === 1 && await num("#opNDraw") === 1, `${label}: a card with no details is counted as a card and listed as unknown; the rest is still analysed`);
  // ---- an empty deck (25), a deck that isn't Commander
  await openOp("e"); await p.waitForSelector("#opEmpty"); ok(/nothing to analyse yet/.test(await txt("#opEmpty")), `${label}: an empty deck says there is nothing to analyse`);
  await openOp("c"); await p.waitForSelector("#opSum");
  ok(/Suggested ranges exist only for Commander decks/.test(await txt("#opAssess")) && (await weak()).length === 0 && !(await p.$("#opHealthy")), `${label}: a deck in another format is shown without Commander's ranges`);
  // ---- checks run directly on the analysis (mocked card text put in memory): late ramp, leaning on the commander, recovery, the curve, counterspells
  const direct = await p.evaluate(async () => {
    const pad = i => String(i).padStart(2, "0"), E = { cmd: "", theme: "", R: null, stat: new Map(), tstat: new Map() }, keys = d => optAnalyze(d, E).weak.map(w => w.key).join();
    const base = (cmdr, extra) => { const d = mkDeck("", "t", "commander", cmdr, 1); put(d, ["Mountain"], 36); for (const [n, k] of [["Draw", 9], ["Answer", 7], ["Wipe", 2], ["Shield", 2]]) put(d, Array.from({ length: k }, (_, i) => n + " " + pad(i + 1))); extra(d); return d; };
    const hf = (d, n) => put(d, Array.from({ length: n }, (_, i) => "Hf " + pad(i + 1)));
    const late = base("Krenko, Mob Boss", d => { put(d, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => "Slow Rock " + i)); hf(d, 33); });
    const lean = base("Magda, Mana Boss", d => { put(d, ["Rock 01", "Rock 02"]); hf(d, 33); put(d, Array.from({ length: 8 }, (_, i) => "Goblin " + pad(i + 1))); });
    const frail = mkDeck("", "t", "commander", "Krenko, Mob Boss", 1); put(frail, ["Mountain"], 36); for (const [n, k] of [["Rock", 10], ["Draw", 9], ["Answer", 7], ["Wipe", 2]]) put(frail, Array.from({ length: k }, (_, i) => n + " " + pad(i + 1))); put(frail, ["Lightning Greaves", "Commander's Shield"]); hf(frail, 33);
    const heavy = base("Krenko, Mob Boss", d => { put(d, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => "Rock " + pad(i))); put(d, Array.from({ length: 20 }, (_, i) => "Giant " + pad(i + 1))); put(d, Array.from({ length: 14 }, (_, i) => "Mid " + pad(i + 1))); });
    const neg = mkDeck("", "t", "commander", "Krenko, Mob Boss", 1); put(neg, ["Negate", "Zap 1"]);
    await optTexts([late, lean, frail, heavy, neg].flatMap(d => Object.values(d.cards).map(c => c.name)));
    const A = optAnalyze(lean, E), N = optAnalyze(neg, E);
    return { late: keys(late), lean: keys(lean), leanWhy: A.weak[0].why, frail: keys(frail), heavy: keys(heavy), counter: N.R.Counterspell.copies, negRem: N.R.Removal.list.map(r => r.name).join() };
  });
  ok(direct.late === "early-ramp", `${label}: nine ramp cards that all cost four: “ramp arrives late”, and nothing else (${direct.late})`);
  ok(direct.lean === "ramp" && /Your commander makes mana itself, so what acceleration there is leans on it/.test(direct.leanWhy), `${label}: two ramp cards and a commander that makes mana: the deck leans on its commander (11)`);
  ok(direct.frail === "recovery", `${label}: 33 creatures, no board-wide protection, no recursion: vulnerable to board wipes (${direct.frail})`);
  ok(direct.heavy === "early-plays,expensive", `${label}: 20 seven-drops with nine ramp cards: few early plays and many expensive cards (${direct.heavy})`);
  ok(direct.counter === 1 && direct.negRem === "Zap 1", `${label}: a counterspell is counted as a counterspell, not as removal`);
  // ---- EDHREC unavailable (22): the composition still works, commander-specific suggestions are said to be missing
  M.edhDown = true; await p.evaluate(async () => { EDH.mem.clear(); for (const k of ["commanders/krenko-mob-boss", "tags/goblins", "commanders/krenko-mob-boss/goblins"]) await idbSet("edh:" + k, null).catch(() => {}); S.decks.g.cards = Object.fromEntries(Object.entries(S.decks.g.cards).filter(([, c]) => !["Ruby Stone", "Fire Diamond", "Ember Rock", "Big Rock"].includes(c.name))); staleIndex(); delete optState.g; });
  await openOp("g"); await p.waitForSelector("#opSum"); await openAll();
  ok(/EDHREC's statistics couldn't be loaded\. The analysis of the deck's own cards below is complete, but commander-specific suggestions are unavailable; nothing is made up in their place\./.test(await txt("#opNoEdh")), `${label}: without EDHREC it says commander-specific suggestions are unavailable`);
  ok(await num("#opNRamp") === 5 && await num("#opNDraw") === 5 && (await weak()).join() === "ramp,card-draw,protection,artifact-enchantment" && (await p.$$eval("#opCurve .op-bar", a => a.map(x => x.textContent.trim()))).join() === "14,24,10,9,2,4", `${label}: the deck's own analysis is the same without it`);
  ok((await recs("ramp", "owned")).join() === "Fire Diamond,Ember Rock,Big Rock,Ruby Stone" && (await recs("ramp", "missing")).length === 0 && /Commander-specific suggestions are unavailable/.test(await txt("#opw-ramp .op-missing")), `${label}: owned cards with the role are still offered (by overall rank, then name); no unowned cards are invented`);
  ok(!/% of Krenko/.test(await txt("#opw-ramp")) && /couldn't be loaded, so commander-specific figures are unavailable/.test(await txt("#opSynNo")) && await num("#opSynTribe b") === 36 && !(await p.$("#opNoLink")), `${label}: no statistics are shown in their place; the creature-type count, which needs no EDHREC, stays`);
  M.edhDown = false;
  // ---- Scryfall unavailable: the saved roles still carry the analysis
  M.sfDown = true; await p.evaluate(() => { OPT.text.clear(); OPT.failed.clear(); delete optState.g; });
  await openOp("g"); await p.waitForSelector("#opSum"); await openAll();
  ok(/rules text couldn't be loaded from Scryfall just now\..*The counts below use the roles saved with each card/.test(await txt("#opNoText")), `${label}: when card text can't be loaded it says so`);
  ok(await num("#opNDraw") === 5 && await num("#opNRem") === 9 && await num("#opNRamp") === 6 && /details not loaded/.test(await cardT("ramp", "Sol Ring")) && !(await weak()).includes("artifact-enchantment"), `${label}: counts come from the saved roles; finer checks that need the text are left out rather than guessed`);
  M.sfDown = false; await p.click("#opRefresh"); await p.waitForSelector("#opSum"); await p.waitForTimeout(300);
  ok(!(await p.$("#opNoText")) && await num("#opNRamp") === 5 && (await weak()).includes("artifact-enchantment"), `${label}: Refresh loads it again once Scryfall answers`);
  // ---- the rest of the app (29–32)
  await p.click('#bMode [data-b="roles"]'); await p.waitForSelector(".baltable");
  ok(await p.$$eval(".baltable .balrow", a => a.length) === 11 && await p.$$eval("[data-fill]", a => a.length) >= 3 && !(await p.$("#op")), `${label}: the role table is still there, with its Find buttons`);
  await p.click('#dTabs [data-t="upgrade"]'); await p.waitForSelector("#uMode"); await p.waitForTimeout(500);
  ok(await p.$eval('#uMode [data-u="swaps"]', e => e.getAttribute("aria-pressed") === "true") && !(await p.$("#bMode")) && !(await p.$("#op")) && (await txt("#dPane")).length > 40, `${label}: the Upgrade tab still opens on its swap suggestions (31)`);
  await p.click('#uMode [data-u="analyze"]'); await p.waitForSelector("#anSum");
  ok(/In your deck12\/50/.test((await txt("#anSum")).replace(/\s/g, "").replace("Inyourdeck", "In your deck")), `${label}: the Top 50 analyzer still works (30) (${(await txt("#anSum")).slice(0, 40)})`);
  await p.click('#dTabs [data-t="suggest"]'); await p.waitForTimeout(500); ok((await txt("#dPane")).length > 40, `${label}: the Suggestions tab still opens`);
  await p.click('#dTabs [data-t="cards"]'); await p.waitForTimeout(300);
  const n0 = await p.evaluate(() => deckStats(S.decks.g).mainN); await p.evaluate(() => { addToDeck(S.decks.g, BY["Shock"], 1, false); renderDeck(S.decks.g); }); await p.waitForTimeout(200);
  ok(await p.evaluate(n => deckStats(S.decks.g).mainN === n + 1, n0) && /Shock/.test(await txt("#view")), `${label}: the deck builder still lists and adds cards (32)`);
  await p.evaluate(() => { tab = "search"; sv.mode = "top50"; go("search"); }); await p.waitForSelector("#tKind");
  await p.evaluate(async () => { Object.assign(t50, { kind: "commander", cmd: "Krenko, Mob Boss", theme: "" }); t50.busy = true; t50.data = await loadTop50({ kind: "commander", cmd: t50.cmd, theme: "" }); t50.busy = false; renderTop50(); }); await p.waitForSelector("#tRows");
  ok(await p.$$eval("#tRows .item", a => a.length) === 50, `${label}: the Top 50 browser still shows its 50 (29)`);
  // ---- layout (33)
  await openOp("g"); await p.waitForSelector("#opSum"); await openAll();
  ok(await fits() && await p.evaluate(() => [...document.querySelectorAll("#op .item, #op .op-card, #opSum, #bMode, #opCurve, #op .kv")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: with every section open, nothing runs off the side of the screen`);
  ok(await p.evaluate(() => [...document.querySelectorAll("#bMode button, #opRefresh, #op [data-opadd]")].every(e => { const r = e.getBoundingClientRect(); return r.width >= 28 && r.height >= 26; }) && [...document.querySelectorAll("#op details > summary")].every(e => e.getBoundingClientRect().height >= 32)), `${label}: the switch, Refresh, the Add buttons and the section headings are big enough to tap`);
  if (process.env.SHOTS) await p.screenshot({ path: `/tmp/opt2_${label}.png`, fullPage: true });
  ok(!errs.length, `${label}: no page errors` + (errs.length ? ": " + errs[0] : ""));
  ok(!failed.length, `${label}: no failed card or statistics requests other than the ones this test cut off on purpose` + (failed.length ? ": " + failed[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8905", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
