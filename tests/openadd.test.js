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
  await p.evaluate(() => { S.decks.d = { id: "d", name: "Krenko", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.c = { id: "c", name: "Casual pile", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; go("decks", "d"); });
  await p.waitForTimeout(300);
  const sheet = () => p.evaluate(() => { const b = document.querySelector("#sheetBody"); return b ? b.textContent.replace(/\s+/g, " ") : ""; });
  const dc = () => p.evaluate(() => Object.values(S.decks.d.cards).map(c => `${c.qty}× ${c.name} ${c.set.toUpperCase()}`).join(" | "));
  await p.click("#dAdd"); await p.keyboard.type("Sol R"); await p.waitForTimeout(400); await p.click("#dAc button"); await p.waitForTimeout(700);
  ok(/In Krenko/.test(await sheet()) && /Change printing in this deck/.test(await sheet()) && /Remove from deck/.test(await sheet()), "adding Sol Ring opens its card screen, set up for this deck");
  await p.click("#cDeckInc"); await p.waitForTimeout(150);
  ok(/2× Sol Ring/.test(await dc()) && /2×/.test(await sheet()), "+ adds a copy to the deck");
  await p.click("#cDeckDec"); await p.waitForTimeout(150);
  ok(/1× Sol Ring/.test(await dc()), "− takes one away");
  await p.click("#cDeckPrint"); await p.waitForTimeout(500);
  await p.evaluate(() => [...document.querySelectorAll("#cDeckPrintBox .prints button[data-i]")].find(t => /LTC/i.test(t.textContent)).click()); await p.waitForTimeout(400);
  ok(/1× Sol Ring LTC/.test(await dc()), "change the printing right there");
  await p.click("#cDeckDel"); await p.waitForTimeout(150);
  ok(await dc() === "" && /Removed from Krenko/.test(await sheet()), "Remove from deck, with a way to put it back");
  await p.click("#cDeckBack"); await p.waitForTimeout(150);
  ok(/1× Sol Ring LTC/.test(await dc()), "Put it back");
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  ok(/Sol Ring/.test(await p.evaluate(() => document.querySelector("#dl").textContent)), "closing returns to the deck, updated");
  await p.fill("#dAdd", ""); await p.click("#dAdd"); await p.keyboard.type("cmm 410"); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  ok(/In Krenko/.test(await sheet()), "also opens after adding by set + number");
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  // sideboard option in non-Commander decks
  await p.evaluate(() => go("decks", "c")); await p.waitForTimeout(200);
  await p.click("#dAdd"); await p.keyboard.type("Lightning B"); await p.waitForTimeout(400); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  await p.click("#cDeckSide"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => Object.values(S.decks.c.cards)[0].side === true) && /Move to main deck/.test(await sheet()), "non-Commander decks: move a card to the sideboard from there");
  await p.click("#sheetClose"); await p.waitForTimeout(200);
  // the switch
  await p.evaluate(() => { S.settings.openAfterAdd = false; go("decks", "d"); }); await p.waitForTimeout(200);
  await p.click("#dAdd"); await p.keyboard.type("For"); await p.waitForTimeout(400); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  ok(!(await p.$("#sheetBody")) && /Forest/.test(await dc()), "with the Deck options switch off, adding doesn't open anything");
  await b.close(); srv.kill();
})();
