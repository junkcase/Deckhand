// Playtest: draw, London mulligan (Commander's free first one), bottoming, turns, play/draw, exact land odds.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// independent check: exact hypergeometric with plain products
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const atLeast = (N, K, n, k) => { let p = 0; for (let i = k; i <= n; i++) p += C(K, i) * C(N - K, n - i) / C(N, n); return p; };
const pctS = p => Math.round(p * 100) + "%";
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8787", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8787/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => {
    const mk = (id, name, type, o = {}) => slim(Object.assign({ id, oracle_id: "o" + id, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "common", type_line: type, cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/small/front/a/b/" + id + ".jpg", normal: "https://cards.scryfall.io/normal/front/a/b/" + id + ".jpg" } }, o));
    const d = S.decks.c = { id: "c", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
    addToDeck(d, mk("cmd", "Kiora, the Crashing Wave", "Legendary Planeswalker — Kiora", { color_identity: ["G", "U"] }), 1, false); d.cmdr = ["cmd|0"];
    addToDeck(d, mk("isl", "Island", "Basic Land — Island"), 20, false); addToDeck(d, mk("for", "Forest", "Basic Land — Forest"), 17, false);
    for (let i = 0; i < 62; i++) addToDeck(d, mk("sp" + i, "Spell " + i, i % 2 ? "Creature — Elf" : "Instant"), 1, false);
    addToDeck(d, mk("sb", "Side Card", "Instant"), 3, true);
    const e = S.decks.m = { id: "m", name: "Modern", format: "modern", cmdr: [], cards: {}, created: 1, updated: 1 };
    addToDeck(e, mk("mnt", "Mountain", "Basic Land — Mountain"), 20, false); addToDeck(e, mk("bolt", "Lightning Bolt", "Instant"), 40, false);
    S.meta.deckStatsOpen = true; save(); go("decks", "c");      // "Mana curve & test draws" open
  });
  await p.waitForTimeout(300);
  const R = {}, st = () => p.evaluate(() => ({ hand: hand.cards.length, lib: hand.lib.length, turn: hand.turn, bottom: hand.bottom, cmdInLib: hand.lib.some(c => /Kiora/.test(c.name)) || hand.cards.some(c => /Kiora/.test(c.name)), side: hand.lib.concat(hand.cards).some(c => c.side) }));
  R.odds = await p.$eval("#ptOdds", e => e.textContent.replace(/\s+/g, " "));
  R.table = await p.$$eval("#ptOdds table tr", a => a.slice(1).map(tr => [...tr.children].map(td => td.textContent.trim()).join(" ")));
  await p.click("#hNew"); await p.waitForTimeout(100); R.s1 = await st(); R.line = await p.$eval("#pt .small", e => e.textContent.replace(/\s+/g, " "));
  await p.click("#hMull"); await p.waitForTimeout(100); R.m1 = await st();                      // Commander: free
  await p.click("#hMull"); await p.waitForTimeout(100); R.m2 = await st(); R.nextDisabled = await p.$eval("#hOne", e => e.disabled);
  await p.click('#hand [data-hc="0"]'); await p.click('#hand [data-hc="1"]'); await p.waitForTimeout(100); R.selCount = await p.evaluate(() => hand.sel.size);   // only 1 may be picked
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  const bottomName = await p.evaluate(() => hand.cards[[...hand.sel][0]].name);
  await p.click("#hBottom"); await p.waitForTimeout(100); R.afterBottom = await st(); R.bottomCard = await p.evaluate(n => hand.lib[0].name === n, bottomName);
  await p.click("#hOne"); await p.waitForTimeout(100); R.t2 = await st();
  await p.click('#ptWho [data-w="draw"]'); await p.waitForTimeout(100); R.draw = await st();
  // a 60-card deck: the first mulligan costs a card
  await p.evaluate(() => { hand.onDraw = false; go("decks", "m"); }); await p.click("#hNew"); await p.click("#hMull"); await p.waitForTimeout(100); R.m60 = await st();
  R.odds60 = await p.$eval("#ptOdds", e => e.textContent.replace(/\s+/g, " "));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  const N = 99, K = 37, want = [1, 2, 3, 4, 5].map(t => [pctS(atLeast(N, K, 6 + t, t)), pctS(atLeast(N, K, 7 + t, t))]);
  let keep = 0; for (let i = 2; i <= 5; i++) keep += C(K, i) * C(N - K, 7 - i) / C(N, 7);
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "playtest_phone.png"]]) {
    const R = await run(opts, shot);
    ok(/37 lands in 99 cards/.test(R.odds) && R.odds.includes("2–5 lands: " + pctS(keep)), `${label}: odds count 99 cards without the commander or sideboard; 2–5 lands ${pctS(keep)} (${R.odds.slice(0, 140)})`);
    const play = want.map(w => w[0]).join(" "), draw = want.map(w => w[1]).join(" ");
    ok(R.table[0] === "On the play " + play && R.table[1] === "On the draw " + draw, `${label}: land-drop table matches exact math (play ${play} · draw ${draw}) ${JSON.stringify(R.table)}`);
    ok(R.s1.hand === 7 && R.s1.lib === 92 && !R.s1.cmdInLib && !R.s1.side && /Turn 1 · on the play · 7 in hand/.test(R.line), `${label}: Draw 7 from 99 (commander and sideboard left out) ${JSON.stringify(R.s1)}`);
    ok(R.m1.hand === 7 && R.m1.bottom === 0, `${label}: Commander's first mulligan is free`);
    ok(R.m2.hand === 7 && R.m2.bottom === 1 && R.nextDisabled, `${label}: second mulligan: pick 1 card to put on the bottom first`);
    ok(R.selCount === 1, `${label}: can't pick more cards than you have to bottom`);
    ok(R.afterBottom.hand === 6 && R.afterBottom.lib === 93 && R.bottomCard, `${label}: the picked card goes to the bottom of the library ${JSON.stringify(R.afterBottom)}`);
    ok(R.t2.turn === 2 && R.t2.hand === 7, `${label}: Next turn draws one`);
    ok(R.draw.hand === 8 && R.draw.turn === 1, `${label}: on the draw, a new hand starts with 8`);
    ok(R.m60.hand === 7 && R.m60.bottom === 1, `${label}: in a 60-card deck the first mulligan costs a card`);
    ok(/20 lands in 60 cards/.test(R.odds60), `${label}: odds for a 60-card deck`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
