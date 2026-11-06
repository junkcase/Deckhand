// Swipe between cards: from a list, the card screen moves to the next/previous card in that list's order
// (sideways swipe, ‹ › buttons, arrow keys); scrolling up/down doesn't; the ends stop; closing goes back to the list.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (set, num, name, usd) => ({ object: "card", id: `${set}-${num}`, oracle_id: "o" + set + num, name, set, set_name: "Test Set", collector_number: String(num), rarity: "common", type_line: "Creature", cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: String(usd) }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: `https://cards.scryfall.io/${set}${num}.png`, normal: `https://cards.scryfall.io/${set}${num}.png` } });
const SET = [card("tst", 1, "Ant", 1), card("tst", 2, "Bee", 2), card("tst", 3, "Cat", 3), card("tst", 4, "Dog", 4)];
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8805", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], imgs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => { imgs.push(r.request().url()); r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (/\/sets(\?|$)/.test(u)) return J({ data: [{ code: "tst", name: "Test Set", released_at: "2025-01-01", card_count: 4, printed_size: 4, set_type: "expansion", icon_svg_uri: "https://svgs.scryfall.io/sets/tst.svg" }] });
    if (u.includes("/cards/search")) return J({ object: "list", data: SET, has_more: false });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8805/app_real.html"); await p.waitForTimeout(500);
  const touch = opts.hasTouch;
  const title = () => p.$eval("#sheetBody h2", e => e.textContent.trim()).catch(() => null);
  const pos = () => p.$eval("#cnPos", e => e.textContent).catch(() => null);
  const swipe = async (dx, dy = 0) => { await p.evaluate(([dx, dy]) => { const sh = document.querySelector("#sheetRoot .sheet"), tgt = document.querySelector("#sheetBody h2") || sh;
      const T = (x, y) => new Touch({ identifier: 1, target: tgt, clientX: x, clientY: y });
      sh.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [T(200, 400)], changedTouches: [T(200, 400)] }));
      sh.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [T(200 + dx, 400 + dy)] })); }, [dx, dy]); await p.waitForTimeout(250); };
  const next = () => touch ? swipe(-120) : p.keyboard.press("ArrowRight").then(() => p.waitForTimeout(250));
  const prev = () => touch ? swipe(120) : p.click("#cnPrev").then(() => p.waitForTimeout(250));
  const R = {};
  // collection: Ant, Bee, Cat (sorted by name)
  await p.evaluate(S_ => { S.binders = { main: { id: "main", name: "Collection" } }; for (const c of S_.slice(0, 3)) addToColl(slim(c), "nonfoil", 1, "main"); cv.sort = "name"; save(); go("coll"); showList(); }, SET);
  await p.waitForTimeout(400);
  R.collOrder = await p.$$eval("#clist [data-open] .name", a => a.map(x => x.textContent.trim()));
  await p.click("#clist [data-open]"); await p.waitForSelector("#cnPos");
  R.c1 = [await title(), await pos(), await p.$eval("#cnPrev", e => e.disabled)];
  await next(); R.c2 = [await title(), await pos()];
  if (touch) { await swipe(-30, -300); R.vertical = await title(); }        // scrolling up the card isn't a swipe
  await next(); R.c3 = [await title(), await pos(), await p.$eval("#cnNext", e => e.disabled)];
  await next(); R.c3end = await title();                                      // the last one stops
  await prev(); R.back1 = await title();
  R.preloaded = imgs.some(u => /tst1\.png/.test(u));
  await p.click("#sheetClose"); await p.waitForTimeout(200); R.closed = await p.evaluate(() => [tab, !!document.querySelector("#sheetRoot .sheet")]);
  // a set's binder: the grid order, and back to the set when closed
  await p.evaluate(() => { sv.mode = "sets"; sv.setCode = "tst"; go("search"); }); await p.waitForSelector("#sdGrid .bcard");
  await p.click('#sdGrid [data-bc="tst-2"]'); await p.waitForSelector("#cnPos");
  R.s1 = [await title(), await pos()]; if (touch) await p.screenshot({ path: __dirname + "/swipe_phone.png" }); await next(); R.s2 = await title();
  await p.click("#cAdd, #cPlus").catch(() => {}); await p.waitForTimeout(150);
  await p.click("#sheetClose"); await p.waitForTimeout(250);
  R.setBack = await p.evaluate(() => [!!document.querySelector("#sdGrid"), document.querySelector('#sdGrid [data-bc="tst-3"]').classList.contains("own")]);
  // a deck: in the deck's sort order
  await p.evaluate(S_ => { const d = { id: "d", name: "D", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.d = d; for (const c of S_) addToDeck(d, c, 1, false, true); S.meta.deckSort = "price"; save(); go("decks", "d"); }, SET);
  await p.waitForTimeout(300); await p.click("#dl [data-open]"); await p.waitForSelector("#cnPos");
  R.d1 = [await title(), await pos()]; await next(); R.d2 = await title();
  await p.click("#sheetClose"); await p.waitForTimeout(150);
  // a card opened on its own (not from a list) has no arrows
  await p.evaluate(S_ => openCard(S_[0]), SET); await p.waitForTimeout(200); R.single = await p.$eval("#cnav", e => e.hidden);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop (buttons, arrow keys)", { viewport: { width: 1280, height: 900 } }], ["phone (swipes)", devices["Pixel 7"]]]) {
    const R = await run(opts), J = JSON.stringify;
    ok(J(R.collOrder) === '["Ant","Bee","Cat"]' && J(R.c1) === '["Ant","1 of 3",true]', `${label}: a card opened from the collection list shows where it is; first has no ‹ ${J([R.collOrder, R.c1])}`);
    ok(J(R.c2) === '["Bee","2 of 3"]' && J(R.c3) === '["Cat","3 of 3",true]' && R.c3end === "Cat", `${label}: next card in the list's order; the last one stops ${J([R.c2, R.c3, R.c3end])}`);
    ok(R.back1 === "Bee", `${label}: previous card (${R.back1})`);
    if (R.vertical !== undefined) ok(R.vertical === "Bee", `${label}: an up/down scroll doesn't change the card (${R.vertical})`);
    ok(R.preloaded, `${label}: the neighbouring cards' pictures load ahead`);
    ok(J(R.closed) === '["coll",false]', `${label}: closing goes back to the list ${J(R.closed)}`);
    ok(J(R.s1) === '["Bee","2 of 4"]' && R.s2 === "Cat", `${label}: from a set's binder, in the grid's order ${J([R.s1, R.s2])}`);
    ok(J(R.setBack) === "[true,true]", `${label}: closing goes back to the set, with the card just added lit up ${J(R.setBack)}`);
    ok(J(R.d1) === '["Dog","1 of 4"]' && R.d2 === "Cat", `${label}: from a deck, in the deck's sort order (price) ${J([R.d1, R.d2])}`);
    ok(R.single === true, `${label}: a card opened on its own has no arrows`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
