// Goldfish simulator + opening-hand odds + mana curve verdict. Checked against exact maths where it exists.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8804", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8804/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(() => {
    const mk = (id, name, type, cmc, qty, roles = []) => ({ id, name, type, cmc, qty, set: "x", num: "1", img: "", prices: { usd: "1" }, finishes: ["nonfoil"], leg: { commander: "l" }, roles });
    const deck = (id, parts, cmdr) => { const cards = {}; for (const c of parts) cards[c.id + "|0"] = c; if (cmdr) cards[cmdr.id + "|0"] = cmdr; return S.decks[id] = { id, name: id, format: "commander", cmdr: cmdr ? [cmdr.id + "|0"] : [], cards, created: 1, updated: 1 }; };
    const cmd = mk("cm", "The Commander", "Legendary Creature", 3, 1);
    const base = deck("a", [mk("l", "Forest", "Basic Land — Forest", 0, 37), mk("s2", "Two Drop", "Creature", 2, 35), mk("s4", "Four Drop", "Creature", 4, 20), mk("k", "Key Card", "Sorcery", 3, 1), mk("s6", "Big Spell", "Sorcery", 6, 6)], cmd);
    const rampy = deck("b", [mk("l", "Forest", "Basic Land — Forest", 0, 37), mk("r", "Mana Rock", "Artifact", 2, 12, ["Ramp"]), mk("s2", "Two Drop", "Creature", 2, 23), mk("s4", "Four Drop", "Creature", 4, 20), mk("k", "Key Card", "Sorcery", 3, 1), mk("s6", "Big Spell", "Sorcery", 6, 6)], cmd);
    const A = goldfish(base, { games: 4000, seed: 7, keys: ["Key Card"] }), B = goldfish(rampy, { games: 4000, seed: 7 }), Ad = goldfish(base, { games: 4000, seed: 9, onDraw: true });
    const o = landOdds(base);
    // exact chance of having seen a 1-of by turn t on the play with no mulligan is (6+t)/99; mulligans add a few points
    const exactKey = t => (6 + t) / 99;
    const heavy = deck("h", [mk("l", "Forest", "Basic Land — Forest", 0, 36), mk("s7", "Huge", "Creature", 7, 30), mk("s5", "Fat", "Creature", 5, 33)], cmd);
    const one = goldfishGame(base, deckLibrary(base), rng(3), { turns: 6, cmdr: cmd, log: true });
    return { keep7: A.keep7 / A.games, keepExact: o.keep, t1: A.onCurve[0] / A.games, t1exact: o.drops[0].play, avg4: A.avg4, avg4ramp: B.avg4, cmdr: A.avgCmdr, cmdrOnTime: A.cmdrOnTime / A.games,
      key: [1, 3, 5].map(t => [A.key[t] / A.games, exactKey(t)]), keyOpen: [A.key[0] / A.games, 7 / 99], drawFaster: Ad.avg4 < A.avg4, small: goldfish(deck("z", [mk("l", "Forest", "Basic Land", 0, 5)]), {}) === null,
      verdictBase: curveVerdict(base).replace(/<[^>]+>/g, ""), verdictHeavy: curveVerdict(heavy).replace(/<[^>]+>/g, ""), log: one.log.map(x => `${x.t}:${x.land ? "L" : "-"}:${x.mana}:${x.cast.length}`), logCmdr: one.log.some(x => x.cast.some(c => /commander/.test(c))),
      speed: (() => { const t0 = performance.now(); goldfish(base, { games: 2000, seed: 1 }); return performance.now() - t0; })() };
  });
  // the UI
  await p.evaluate(() => go("decks", "a")); await p.waitForTimeout(300);
  await p.selectOption('[data-gk="0"]', "Key Card"); await p.click("#gfRun"); await p.waitForSelector("#gf .summary", { timeout: 10000 });
  R.ui = await p.$eval("#gf", e => e.textContent.replace(/\s+/g, " "));
  await p.click("#gfLog summary"); await p.click("#gfOne"); await p.waitForTimeout(200); R.uiLog = await p.$$eval("#gfLog li", a => a.map(x => x.textContent));
  R.uiCurve = await p.$eval(".curve-x + p", e => e.textContent).catch(() => "");
  if (shot) { await p.$eval("#gf", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot }); }
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "goldfish_phone.png"]]) {
    const R = await run(opts, shot), near = (a, b, d) => Math.abs(a - b) <= d;
    ok(near(R.keep7, R.keepExact, 0.03), `[${label}] keep-7 rate matches the exact odds (${(R.keep7 * 100).toFixed(1)}% vs ${(R.keepExact * 100).toFixed(1)}%)`);
    ok(R.t1 >= R.t1exact - 0.01, `[${label}] turn-1 land at least as often as a single 7 gives (mulligans only help): ${(R.t1 * 100).toFixed(1)}% vs ${(R.t1exact * 100).toFixed(1)}%`);
    ok(R.key.every(([s, e]) => s >= e - 0.03 && s <= e + 0.08), `[${label}] chance of seeing a 1-of key card tracks the exact maths ${JSON.stringify(R.key.map(([s, e]) => [+s.toFixed(3), +e.toFixed(3)]))}`);
    ok(near(R.keyOpen[0], R.keyOpen[1], 0.025), `[${label}] key card in the opening hand: ${(R.keyOpen[0] * 100).toFixed(1)}% (exact 7/99 = ${(R.keyOpen[1] * 100).toFixed(1)}%)`);
    ok(R.avg4ramp < R.avg4 - 0.3, `[${label}] mana rocks reach 4 mana sooner (${R.avg4ramp.toFixed(2)} vs ${R.avg4.toFixed(2)})`);
    ok(R.drawFaster, `[${label}] on the draw reaches 4 mana a bit sooner (an extra card)`);
    ok(R.cmdr > 3 && R.cmdr < 4.2 && R.cmdrOnTime > 0.6, `[${label}] a 3-mana commander comes out around turn 3 (avg ${R.cmdr.toFixed(2)}, on curve ${(R.cmdrOnTime * 100).toFixed(0)}%)`);
    ok(R.small, `[${label}] too few cards: no simulation`);
    ok(/In the usual range/.test(R.verdictBase) && /Top-heavy/.test(R.verdictHeavy) && /30 spells cost 6 or more/.test(R.verdictHeavy), `[${label}] curve verdict: "${R.verdictBase.slice(0, 60)}…" / "${R.verdictHeavy.slice(0, 70)}…"`);
    ok(R.log.length === 6 && R.logCmdr, `[${label}] one game turn by turn, including the commander ${JSON.stringify(R.log)}`);
    ok(R.speed < 2000, `[${label}] 2,000 games in ${R.speed.toFixed(0)} ms`);
    ok(/Keep 7/.test(R.ui) && /4 mana by/.test(R.ui) && /Commander out/.test(R.ui) && /Seen Key Card/.test(R.ui) && /Missed land drop/.test(R.ui), `[${label}] results on the deck screen: ${R.ui.slice(0, 160)}`);
    ok(R.uiLog.length === 6 && /^Turn 1:/.test(R.uiLog[0]), `[${label}] "Watch one game" lists each turn ${JSON.stringify(R.uiLog.slice(0, 2))}`);
    ok(/usual range|Top-heavy|Low curve/.test(R.uiCurve), `[${label}] verdict under the mana curve`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no errors ${JSON.stringify(R.errs)}`);
  }
})();
