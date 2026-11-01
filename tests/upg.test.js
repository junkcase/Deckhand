const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const G = { colors: ["G"], color_identity: ["G"] };
const C = (name, o = {}) => Object.assign({ object: "card", id: "id-" + name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Sorcery", cmc: 2, mana_cost: "{1}{G}", prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" }, oracle_text: "" }, G, o);
const CARDS = Object.fromEntries([
  C("Ghalta, Primal Hunger", { type_line: "Legendary Creature — Elder Dinosaur", cmc: 12, oracle_text: "Trample" }),
  C("Mind Stone", { type_line: "Artifact", colors: [], color_identity: [], oracle_text: "{T}: Add {C}.\n{1}, {T}, Sacrifice Mind Stone: Draw a card.", prices: { usd: "0.30" } }),
  C("Grizzly Bears", { type_line: "Creature — Bear", oracle_text: "", prices: { usd: "0.10" } }),
  C("Colossal Dreadmaw", { type_line: "Creature — Dinosaur", cmc: 6, oracle_text: "Trample", prices: { usd: "0.20" } }),
  C("Cultivate", { cmc: 3, oracle_text: "Search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.", prices: { usd: "0.40" } }),
  C("Nature's Lore", { oracle_text: "Search your library for a Forest card, put that card onto the battlefield, then shuffle.", prices: { usd: "0.80" } }),
  C("Garruk's Uprising", { type_line: "Enchantment", cmc: 3, oracle_text: "When Garruk's Uprising enters, if you control a creature with power 4 or greater, draw a card.", prices: { usd: "0.60" } }),
  C("Craterhoof Behemoth", { type_line: "Creature — Beast", cmc: 8, oracle_text: "Haste. When this enters, creatures you control gain trample.", prices: { usd: "30.00" } }),
  C("Elvish Mystic", { type_line: "Creature — Elf Druid", cmc: 1, oracle_text: "{T}: Add {G}.", prices: { usd: "0.50" } }),
  C("Swords to Plowshares", { colors: ["W"], color_identity: ["W"], type_line: "Instant", cmc: 1, oracle_text: "Exile target creature." }),
  C("Mana Crypt", { type_line: "Artifact", colors: [], color_identity: [], cmc: 0, legalities: { commander: "banned" }, oracle_text: "{T}: Add {C}{C}." }),
].map(c => [c.name, c]));
const v = (n, num, syn) => ({ name: n, num_decks: num, potential_decks: 10772, synergy: syn });
const EDH = { "commanders/ghalta-primal-hunger": { panels: { taglinks: [{ value: "Dinosaurs", slug: "dinosaurs", count: 3000 }] }, container: { json_dict: { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [
  v("Nature's Lore", 6900, 0.31), v("Garruk's Uprising", 5400, 0.4), v("Craterhoof Behemoth", 4800, 0.5), v("Elvish Mystic", 6000, 0.2), v("Cultivate", 6000, 0.1), v("Mind Stone", 500, -0.02), v("Colossal Dreadmaw", 900, -0.05), v("Swords to Plowshares", 300, 0.0), v("Mana Crypt", 2000, 0.01)] }] } } } };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8775", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 420, height: 1000 } }); p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://json.edhrec.com/**", route => { const path = new URL(route.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); return EDH[path] ? route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(EDH[path]) }) : route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.route("https://api.scryfall.com/**", route => { const u = decodeURIComponent(route.request().url()), J = j => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: Object.keys(CARDS) }); if (u.endsWith("/sets")) return J({ data: [] });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(route.request().postData()).identifiers; return J({ data: ids.map(i => CARDS[i.name] || Object.values(CARDS).find(c => c.id === i.id)).filter(Boolean), not_found: [] }); }
    return route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8775/app_real.html"); await p.waitForTimeout(600);
  await p.evaluate(CARDS => {
    const sl = n => slim(CARDS[n]);
    addToColl(sl("Nature's Lore"), "nonfoil", 1, "main"); addToColl(sl("Garruk's Uprising"), "nonfoil", 1, "main");
    S.settings.shareCopies = false;
    const mk = (id, name) => S.decks[id] = { id, name, format: "commander", cmdr: [], cards: {}, created: Date.now(), updated: Date.now() };
    const st = mk("stompy", "Stompy"); addToDeck(st, sl("Garruk's Uprising"), 1, false);
    const d = mk("gh", "Ghalta"); for (const n of ["Ghalta, Primal Hunger", "Mind Stone", "Grizzly Bears", "Colossal Dreadmaw", "Cultivate"]) addToDeck(d, sl(n), 1, false);
    d.cmdr = ["id-ghalta-primal-hunger|0"]; deckTab.gh = "upgrade"; go("decks", "gh");
  }, CARDS);
  await p.waitForTimeout(1800);
  const pane = async () => (await p.evaluate(() => document.querySelector("#dPane").textContent)).replace(/\s+/g, " ");
  const swaps = () => p.$$eval(".swap", ss => ss.map(s => [...s.querySelectorAll(".sc b")].map(b => b.textContent).join(" → ")));
  let t = await pane(), sw = await swaps();
  ok(/Deck health/.test(t) && /3 of 4 nonland cards appear/.test(t) && /appear in EDHREC's Ghalta, Primal Hunger data/.test(t) && /not a power rating/.test(t), "deck health: how many cards are in Ghalta's EDHREC data, average synergy, and a note that it isn't a power rating");
  ok(/Weaknesses/.test(t) && /Card draw: 1 \(suggested 9–12\)\. Draw keeps your hand full/.test(t) && /Board wipe: 0/.test(t), "weaknesses with counts, ranges and why they matter");
  ok(sw.includes("Mind Stone → Nature's Lore"), "swap: Mind Stone (ramp, in 5% of Ghalta decks) → Nature's Lore (ramp, 64%): " + sw.join(" | "));
  const allIn = sw.join(" ");
  ok(!/Swords to Plowshares|Mana Crypt/.test(allIn), "never suggests off-color (Swords) or banned (Mana Crypt) cards");
  ok(!/Cultivate →/.test(allIn), "doesn't suggest cutting Cultivate (in 56% of Ghalta decks)");
  ok(/Why cut: Only in 5% of Ghalta, Primal Hunger decks/.test(t) && /\+ In 64% of Ghalta, Primal Hunger decks vs 5%/.test(t), "explains the cut and the benefit with real numbers");
  const groupsTxt = await p.$$eval("#dPane .group-h", g => g.map(x => x.textContent.replace(/\d+$/, "").trim()));
  ok(groupsTxt.includes("You own it") && groupsTxt.includes("To buy"), "grouped: You own it / In another deck / To buy: " + groupsTxt.join(", "));
  // budget
  await p.click('#uBud [data-b="10"]'); await p.waitForTimeout(600); t = await pane();
  const m = t.match(/Within your \$10\.00 budget: (\d+) upgrades?, \$([\d.]+) total, \$([\d.]+) left/);
  ok(m && +m[2] <= 10 && Math.abs(+m[2] + +m[3] - 10) < 0.01, `budget $10: ${m ? m[0] : "?"}`);
  // replace with confirmation; other deck untouched
  const btnIdx = async (re, attr) => p.evaluate(([re, attr]) => { const sw = [...document.querySelectorAll(".swap")].find(s => new RegExp(re).test([...s.querySelectorAll(".sc b")].map(b => b.textContent).join(" → "))); return sw ? sw.querySelector(`[${attr}]`).getAttribute(attr) : null; }, [re, attr]);
  const idx = await btnIdx("Mind Stone → Nature's Lore", "data-srep");
  await p.click(`[data-srep="${idx}"]`); await p.waitForTimeout(150);
  ok(/Take out Mind Stone and put in Nature's Lore\?/.test(await pane()), "Replace asks first");
  await p.click(`#sy-${idx}`); await p.waitForTimeout(800);
  let deck = await p.evaluate(() => Object.values(S.decks.gh.cards).map(c => c.name).sort());
  ok(deck.includes("Nature's Lore") && !deck.includes("Mind Stone"), "replaced: Mind Stone out, Nature's Lore in");
  ok(await p.evaluate(() => Object.values(S.decks.stompy.cards).map(c => c.name + c.qty).join()) === "Garruk's Uprising1" && await p.evaluate(() => Object.values(S.coll).length) === 2, "the other deck and the collection are untouched");
  ok(/Replaced Mind Stone with Nature's Lore/.test(await pane()), "listed in the deck's history");
  // a card whose only copy is in Stompy: replace only moves it when chosen
  const gi = await btnIdx("→ Garruk's Uprising", "data-srep");
  if (gi != null) {
    await p.click(`[data-srep="${gi}"]`); await p.waitForTimeout(150);
    ok(/Your copy is in Stompy/.test(await pane()) && await p.$(`#sm-${gi}`), "card in another deck: says so, and offers to move it (only if you choose)");
    await p.click(`#sm-${gi}`); await p.waitForTimeout(800);
    ok(await p.evaluate(() => Object.keys(S.decks.stompy.cards).length) === 0 && await p.evaluate(() => Object.values(S.decks.gh.cards).some(c => c.name === "Garruk's Uprising")), "moved from Stompy into Ghalta when chosen");
    const hid = await p.evaluate(() => S.decks.gh.history.filter(h => /Garruk/.test(h.text)).pop().id);
    await p.click(`[data-hundo="${hid}"]`).catch(async () => { await p.evaluate(() => document.querySelector("details:last-of-type").open = true); await p.click(`[data-hundo="${hid}"]`); }); await p.waitForTimeout(600);
    ok(await p.evaluate(() => Object.values(S.decks.stompy.cards).map(c => c.name).join()) === "Garruk's Uprising" && !(await p.evaluate(() => Object.values(S.decks.gh.cards).some(c => c.name === "Garruk's Uprising"))), "Undo puts it back in Stompy and restores the card it replaced");
  } else ok(false, "expected a swap to Garruk's Uprising: " + sw.join(" | "));
  // skip and keep
  sw = await swaps(); const first = sw[0];
  await p.click(`[data-sno="${await btnIdx(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "data-sno")}"]`); await p.waitForTimeout(600);
  ok(!(await swaps()).includes(first), "Skip hides that suggestion: " + first);
  // report
  t = await pane();
  ok(/Since Today/.test(t) && /Replaced Mind Stone with Nature's Lore/.test(t) && /Skipped:/.test(t) && /Average mana value/.test(t), "report: before → now, changes made, skipped, curve and synergy");
  await p.evaluate(() => { for (const d of document.querySelectorAll("#dPane details")) d.open = true; }); await p.click("#uSaveRep"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => (S.decks.gh.upg.reports || []).length) === 1, "report saved with the deck");
  // CI with a non-commander-legal check via Suggestions untouched; final undo of the first replacement
  const h0 = await p.evaluate(() => S.decks.gh.history.find(h => /Mind Stone/.test(h.text)).id);
  await p.evaluate(id => { undoUpgrade(S.decks.gh, id); }, h0);
  deck = await p.evaluate(() => Object.values(S.decks.gh.cards).map(c => c.name).sort());
  ok(deck.includes("Mind Stone") && !deck.includes("Nature's Lore"), "undo from history works for an earlier change too");
  await p.evaluate(() => { deckTab.gh = "upgrade"; renderDeck(S.decks.gh); }); await p.waitForTimeout(900);
  await p.screenshot({ path: "upg_phone.png", fullPage: true });
  await p.evaluate(() => { S.decks.gh.upg.budget = 0.4; renderDeck(S.decks.gh); }); await p.waitForTimeout(600);
  const tb = (await p.evaluate(() => document.querySelector("#dPane").textContent)).replace(/\s+/g, " ");
  ok(/Within your \$0\.40 budget: 0 upgrades, \$0\.00 total, \$0\.40 left/.test(tb) && /Over your budget/.test(tb), "a $0.40 budget: the $0.50 Elvish Mystic is marked over budget, totals add up");
  await b.close(); srv.kill();
})();
