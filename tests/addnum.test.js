const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, set, num, o = {}) => Object.assign({ object: "card", id: `${set}-${num}`, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, released_at: "2023-01-01", rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" }, oracle_text: "{T}: Add {C}{C}." }, o);
const ALL = [C("Sol Ring", "cmm", "410"), C("Sol Ring", "ltc", "284"), C("Forest", "dom", "266", { type_line: "Basic Land — Forest", oracle_text: "({T}: Add {G}.)" }), C("Lightning Bolt", "2x2", "117", { type_line: "Instant" }), C("Lightning Bolt", "clb", "187", { type_line: "Instant" }),
  C("Krenko, Mob Boss", "ddt", "52", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] }), C("Krenko, Mob Boss", "m13", "139", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] })];
const newest = n => ALL.filter(c => c.name === n)[0];
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: [...new Set(ALL.map(c => c.name))] }); if (u.endsWith("/sets")) return J({ data: [] });
    let m = u.match(/named\?exact=([^&]+)(?:&set=(\w+))?/); if (m) { const c = ALL.find(c => c.name === m[1] && (!m[2] || c.set === m[2])); return c ? J(c) : J({ details: "No card" }, 404); }
    m = u.match(/named\?fuzzy=([^&]+)/); if (m) { const c = ALL.find(c => c.name.toLowerCase().startsWith(m[1].toLowerCase())); return c ? J(c) : J({}, 404); }
    m = u.match(/\/cards\/(\w+)\/(\w+)$/); if (m) { const c = ALL.find(c => c.set === m[1] && c.collector_number === m[2]); return c ? J(c) : J({ details: "Not found" }, 404); }
    if (u.includes("unique=prints")) { const n = u.match(/!"([^"]+)"/)[1]; return J({ data: ALL.filter(c => c.name === n), has_more: false }); }
    if (u.includes("/cards/collection")) return J({ data: [], not_found: [] });
    return J({}, 404); });
  await p.goto("http://127.0.0.1:8777/app_real.html"); await p.waitForTimeout(600);
  await p.evaluate(() => { S.settings.openAfterAdd = false; S.decks.d = { id: "d", name: "Krenko", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; go("decks", "d"); });
  await p.waitForTimeout(400);
  const cards = () => p.evaluate(() => Object.values(S.decks.d.cards).map(c => `${c.qty}× ${c.name} ${c.set.toUpperCase()} #${c.num}`).sort().join(" | "));
  const toastT = () => p.evaluate(() => document.querySelector("#toastRoot").textContent);
  const type = async (t, how = "Enter") => { await p.fill("#dAdd", ""); await p.click("#dAdd"); await p.keyboard.type(t); await p.waitForTimeout(400); if (how === "Enter") await p.keyboard.press("Enter"); else await p.click("#dAc button"); await p.waitForTimeout(700); };
  await type("4 For", "click");
  ok(/4× Forest DOM #266/.test(await cards()) && /Added 4× Forest/.test(await toastT()), "“4 For” → pick Forest from the list → 4 Forests");
  await type("3x Lightning Bolt");
  ok(/3× Lightning Bolt 2X2 #117/.test(await cards()), "“3x Lightning Bolt” + Enter → 3 copies");
  await type("Sol Ring LTC 284");
  ok(/1× Sol Ring LTC #284/.test(await cards()) && /Sol Ring \(LTC #284\)/.test(await toastT()), "“Sol Ring LTC 284” → exactly that printing");
  await type("cmm 410");
  ok(/1× Sol Ring CMM #410/.test(await cards()), "“cmm 410” (set + number only) → Sol Ring from Commander Masters");
  await type("2 Lightning Bolt (CLB) 187");
  ok(/2× Lightning Bolt CLB #187/.test(await cards()), "deck-list style “2 Lightning Bolt (CLB) 187”");
  await type("Krenko, Mob Boss (M13)");
  ok(/1× Krenko, Mob Boss M13 #139/.test(await cards()), "set without a number “Krenko, Mob Boss (M13)” → that set's printing");
  const before = await cards();
  await type("Sol Ring CMM 999");
  ok(await cards() === before && /No card found for CMM #999/.test(await toastT()), "a number that doesn't exist: nothing added, says so");
  await type("Lightning Bolt cmm 410");
  ok(await cards() === before && /CMM #410 is Sol Ring, not Lightning Bolt/.test(await toastT()), "name and number that don't match: warns instead of adding the wrong card");
  ok(/CMM #410/.test(await p.evaluate(() => document.querySelector("#dl").textContent)), "deck rows show each card's set and number");
  // change printing of a card already in the deck (the commander, to check it stays commander)
  await p.evaluate(() => { const k = Object.keys(S.decks.d.cards).find(k => S.decks.d.cards[k].name === "Krenko, Mob Boss"); S.decks.d.cmdr = [k]; renderDeck(S.decks.d); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { const k = S.decks.d.cmdr[0]; document.querySelector(`#dl [data-open="${k}"]`).click(); }); await p.waitForTimeout(500);
  ok(/In Krenko/.test(await p.evaluate(() => document.querySelector("#sheetBody").textContent)) && await p.$("#cDeckPrint"), "card screen opened from the deck shows its printing there, with “Change printing in this deck”");
  await p.click("#cDeckPrint"); await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll("#cDeckPrintBox .prints button[data-i]")].find(t => /DDT/i.test(t.textContent)).click()); await p.waitForTimeout(500);
  const dk = await p.evaluate(() => ({ cm: S.decks.d.cards[S.decks.d.cmdr[0]], names: Object.values(S.decks.d.cards).filter(c => c.name === "Krenko, Mob Boss").length }));
  ok(dk.cm && dk.cm.set === "ddt" && dk.cm.num === "52" && dk.names === 1, "changed to the DDT printing: still the commander, no duplicate");
  ok(/In Krenko[\s\S]*DDT #52/.test(await p.evaluate(() => document.querySelector("#sheetBody").textContent)), "the card screen updates to the new printing");
  await b.close(); srv.kill();
})();
