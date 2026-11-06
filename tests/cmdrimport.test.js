// Commander deck lists: pasting "Commander / 1 Atraxa / (blank) / the 99" keeps the 99 in the main deck, not the commander
// section; and a deck whose cards ended up in the sideboard can move them all to the main deck in one tap.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const CARD = (name, type) => ({ object: "card", id: name.toLowerCase().replace(/\W+/g, "-"), oracle_id: "o-" + name, name, set: "cmm", set_name: "Commander Masters", collector_number: "1", rarity: "rare", type_line: type, cmc: 2, mana_cost: "{2}", colors: [], color_identity: [],
  prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" } });
const KNOWN = { "atraxa, praetors' voice": CARD("Atraxa, Praetors' Voice", "Legendary Creature — Phyrexian Angel Horror"), "sol ring": CARD("Sol Ring", "Artifact"), "lightning bolt": CARD("Lightning Bolt", "Instant"), "island": CARD("Island", "Basic Land — Island") };
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8803", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
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
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${JSON.stringify(R.errs)}`);
  }
})();
