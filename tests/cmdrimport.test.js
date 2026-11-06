// Commander deck lists: pasting "Commander / 1 Atraxa / (blank) / the 99" keeps the 99 in the main deck, not the commander
// section; and a deck whose cards ended up in the sideboard can move them all to the main deck in one tap.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const CARD = (name, type) => ({ object: "card", id: name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "Commander Masters", collector_number: "1", rarity: "rare", type_line: type, cmc: 2, mana_cost: "{2}", colors: [], color_identity: [],
  prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" } });
const KNOWN = { "atraxa, praetors' voice": CARD("Atraxa, Praetors' Voice", "Legendary Creature — Phyrexian Angel Horror"), "krenko, mob boss": CARD("Krenko, Mob Boss", "Legendary Creature — Goblin Warrior"), "sol ring": CARD("Sol Ring", "Artifact"), "lightning bolt": CARD("Lightning Bolt", "Instant"), "island": CARD("Island", "Basic Land — Island") };
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8803", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], searches = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.includes("/cards/search")) { searches.push(decodeURIComponent(u)); return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ object: "list", data: [KNOWN["atraxa, praetors' voice"], KNOWN["krenko, mob boss"]], has_more: false }) }); }
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: ids.map(i => KNOWN[(i.name || "").toLowerCase()]).filter(Boolean), not_found: [] }) }); }
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8803/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  const deck = id => p.evaluate(id => { const d = S.decks[id], sum = f => Object.values(d.cards).filter(f).reduce((a, c) => a + c.qty, 0);
    return { main: sum(c => !c.side), side: sum(c => c.side), cmdr: d.cmdr.map(k => d.cards[k] && d.cards[k].name), format: d.format }; }, id);
  // 1. paste a Commander list with a "Commander" heading and no "Deck" heading
  await p.evaluate(() => { S.decks.p = { id: "p", name: "Pasted", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("decks", "p"); }); await p.waitForTimeout(300);
  await p.click("#dMenu"); await p.waitForSelector("#pl");
  await p.fill("#pl", "Commander\n1 Atraxa, Praetors' Voice\n\n1 Sol Ring\n1 Lightning Bolt\n97 Island");
  await p.click("#plGo"); await p.waitForFunction(() => /Added|added/.test((document.querySelector("#plMsg") || {}).textContent || "") || Object.keys(S.decks.p.cards).length > 2, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300); R.paste = await deck("p");
  await p.evaluate(() => closeSheet());
  // 2. a deck imported before the fix, with its 99 in the sideboard: one tap moves them back
  await p.evaluate(() => { const cards = {}, mk = (id, name, type, side, qty = 1) => { cards[id + "|" + (side ? 1 : 0)] = { id, name, type, set: "cmm", num: "1", qty, cmc: 2, side: !!side, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: { commander: "l" }, roles: [] }; };
    mk("a", "Atraxa, Praetors' Voice", "Legendary Creature — Phyrexian Angel Horror"); mk("s", "Sol Ring", "Artifact", true); mk("b", "Lightning Bolt", "Instant", true); mk("i", "Island", "Basic Land — Island", true, 95); mk("i2", "Island", "Basic Land — Island", false, 2);
    cards["i|0"] = Object.assign({}, cards["i|1"], { side: false, qty: 2 }); delete cards["i2|0"];
    S.decks.m = { id: "m", name: "Moved", format: "commander", cmdr: ["a|0"], cards, created: 1, updated: 1 }; save(); go("decks", "m"); });
  await p.waitForTimeout(300); R.before = await deck("m"); R.btn = await p.$eval("#dSideMain", e => e.textContent).catch(() => "(no button)");
  await p.click("#dSideMain", { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(200); R.after = await deck("m"); R.island = await p.evaluate(() => S.decks.m.cards["i|0"].qty);
  R.btnGone = await p.$("#dSideMain") === null; R.toast = await p.$eval("#toastRoot", e => e.textContent);
  // 3. typing a commander's name: the keyboard stays up while results come in; the deck's own legendary cards are offered first
  await p.evaluate(() => { const cards = {}, mk = (id, name, type, qty = 1) => { cards[id + "|0"] = { id, name, type, set: "cmm", num: "1", qty, cmc: 2, side: false, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: { commander: "l" }, roles: [] }; };
    mk("k", "Krenko, Mob Boss", "Legendary Creature — Goblin Warrior"); mk("z", "Zurgo Helmsmasher", "Legendary Creature — Orc Warrior"); mk("m", "Mountain", "Basic Land — Mountain", 98);
    S.decks.t = { id: "t", name: "Typing", format: "commander", cmdr: [], cards, created: 1, updated: 1 }; save(); go("decks", "t"); });
  await p.waitForSelector("#cpQ"); await p.waitForTimeout(1200);
  R.fromDeck = await p.$$eval("#cpDeck [data-dk] .nm", a => a.map(x => x.textContent.trim()));
  await p.evaluate(() => { document.querySelector("#cpQ").__mine = true; });
  await p.click("#cpQ"); const n0 = searches.length;
  for (const ch of "kre") { await p.keyboard.type(ch); await p.waitForTimeout(1000); }      // pause after each letter, long enough for results to arrive
  R.typing = await p.evaluate(() => { const q = document.querySelector("#cpQ"); return { same: !!q.__mine, focused: document.activeElement === q, value: q.value, tiles: document.querySelectorAll("#cpRes [data-ci]").length }; });
  R.searched = searches.length - n0;
  await p.keyboard.type("nko"); await p.keyboard.press("Enter"); await p.waitForTimeout(400); R.enter = searches.slice(-1)[0] || "";
  await p.click('#cpDeck [data-dk="k|0"]'); await p.waitForTimeout(200); R.picked = await deck("t");
  // 4. import a file: a Commander list with no commander marked, everything found → straight to the deck, with a message
  const imp = async (name, text) => { await p.evaluate(([name, text]) => csvImport({ name, text: async () => text }, { kind: "deck", id: "__new" }), [name, text]); await p.waitForSelector("#impGo"); await p.click("#impGo");
    await p.waitForFunction(() => !document.querySelector("#impBody") || document.querySelector("#impDone"), null, { timeout: 8000 }); await p.waitForTimeout(200); };
  await imp("auto.txt", "1 Sol Ring\n1 Lightning Bolt\n1 Atraxa, Praetors' Voice\n97 Island");
  R.whole = await p.evaluate(() => { const d = Object.values(S.decks).find(x => x.name === "auto"); return { sheet: !!document.querySelector("#impBody"), deckOpen: deckOpen === (d && d.id), toast: document.querySelector("#toastRoot").textContent, cmdr: d ? d.cmdr.map(k => d.cards[k].name) : null }; });
  // with a card that couldn't be found: the result replaces the form, so there's no Import button to press twice
  await imp("partial.txt", "1 Sol Ring\n1 Atraxa, Praetors' Voice\n1 Not A Real Card\n97 Island");
  R.partial = await p.evaluate(() => ({ go: !!document.querySelector("#impGo"), text: document.querySelector("#impBody").textContent.replace(/\s+/g, " "), open: !!document.querySelector("#impDone") }));
  await p.click("#impDone"); await p.waitForTimeout(200); R.partialOpen = await p.evaluate(() => { const d = Object.values(S.decks).find(x => x.name === "partial"); return deckOpen === (d && d.id) && !document.querySelector("#impBody"); });
  // 5. Archidekt-style tags in the paste box
  await p.evaluate(() => { S.decks.a = { id: "a", name: "Archidekt", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("decks", "a"); }); await p.waitForTimeout(300);
  await p.click("#dMenu"); await p.waitForSelector("#pl");
  await p.fill("#pl", "1x Atraxa, Praetors' Voice [Commander{top}]\n1x Sol Ring [Ramp]\n1x Lightning Bolt [Removal]\n1x Krenko, Mob Boss [Maybeboard]\n97x Island [Land]");
  await p.click("#plGo"); await p.waitForFunction(() => /added/i.test((document.querySelector("#plMsg") || {}).textContent || ""), null, { timeout: 8000 }); await p.waitForTimeout(200);
  R.archidekt = await deck("a"); R.archNames = await p.evaluate(() => Object.values(S.decks.a.cards).map(c => c.name).sort());
  await p.evaluate(() => closeSheet());
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts);
    ok(R.paste.main === 100 && R.paste.side === 0 && JSON.stringify(R.paste.cmdr) === `["Atraxa, Praetors' Voice"]`, `${label}: pasted Commander list: Atraxa is the commander, the rest is the main deck ${JSON.stringify(R.paste)}`);
    ok(R.before.side === 97 && /Move all 97 sideboard cards to the main deck/.test(R.btn), `${label}: a deck with cards in the sideboard offers to move them (${R.btn})`);
    ok(R.after.side === 0 && R.after.main === 100 && R.island === 97 && JSON.stringify(R.after.cmdr) === `["Atraxa, Praetors' Voice"]`, `${label}: all moved to the main deck, copies of the same card merged, commander kept ${JSON.stringify(R.after)} islands ${R.island}`);
    ok(R.btnGone && /Moved 97 cards to the main deck/.test(R.toast), `${label}: button goes away once the sideboard is empty; says what it did`);
    ok(JSON.stringify(R.fromDeck) === '["Krenko, Mob Boss","Zurgo Helmsmasher"]', `${label}: the commander picker offers the deck's own legendary creatures first ${JSON.stringify(R.fromDeck)}`);
    ok(R.typing.same && R.typing.focused && R.typing.value === "kre" && R.typing.tiles > 0, `${label}: typing a commander's name, pausing between letters: same box, still focused (keyboard stays up), results shown ${JSON.stringify(R.typing)}`);
    ok(R.searched >= 1 && R.searched <= 3 && /name:"krenko"/.test(R.enter), `${label}: searches when typing pauses; Enter searches straight away (${R.searched} searches; ${R.enter.slice(-40)})`);
    ok(JSON.stringify(R.picked.cmdr) === '["Krenko, Mob Boss"]' && R.picked.main === 100, `${label}: tapping a card from the deck makes it the commander without adding a copy ${JSON.stringify(R.picked)}`);
    ok(!R.whole.sheet && R.whole.deckOpen && /Your deck “auto” has been added: 100 cards, commander Atraxa/.test(R.whole.toast) && JSON.stringify(R.whole.cmdr) === `["Atraxa, Praetors' Voice"]`, `${label}: a whole import goes straight to the deck, says so, and the only legendary creature is the commander ${JSON.stringify(R.whole)}`);
    ok(!R.partial.go && R.partial.open && /Your deck “partial” has been added: 99 cards/.test(R.partial.text) && /Not A Real Card/.test(R.partial.text) && /only legendary creature/.test(R.partial.text) && R.partialOpen, `${label}: with a card not found, the result replaces the form (no second Import), then opens the deck ${R.partial.text.slice(0, 220)}`);
    ok(JSON.stringify(R.archidekt.cmdr) === `["Atraxa, Praetors' Voice"]` && R.archidekt.main === 100 && R.archidekt.format === "commander" && !R.archNames.includes("Krenko, Mob Boss"), `${label}: Archidekt tags: [Commander] is the commander, [Maybeboard] left out, other tags ignored ${JSON.stringify([R.archidekt, R.archNames])}`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${JSON.stringify(R.errs)}`);
  }
})();
