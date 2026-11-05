// Commander bracket check and deck value history on the Balance tab.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const GC = ["Rhystic Study", "Smothering Tithe", "Demonic Tutor", "Cyclonic Rift", "Farewell"], XT = ["Time Warp", "Temporal Manipulation", "Capture of Jingzhou", "Temporal Mastery"], MLD = ["Armageddon"];
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8790", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], qs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 404, body: "" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/search")) { if (/is:gamechanger|otag:/.test(u)) qs.push(u); const L = /is:gamechanger/.test(u) ? GC : /otag:extra-turn/.test(u) ? XT : /otag:mass-land-denial/.test(u) ? MLD : []; return J({ object: "list", has_more: false, data: L.map(name => ({ name })) }); }
    if (u.includes("/cards/collection")) return J({ data: [], not_found: [] });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8790/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  const setDeck = cards => p.evaluate(cards => {
    const mk = (n, t = "Instant") => slim({ id: "id-" + n.replace(/\W/g, ""), oracle_id: "o" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: t, cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: "2" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "", normal: "" } });
    const d = S.decks.c = { id: "c", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1, vh: S.decks.c && S.decks.c.vh };
    for (const n of cards) addToDeck(d, mk(n), 1, false);
    S.roles = { "Vampiric Tutor": ["Tutor"], "Enlightened Tutor": ["Tutor"], "Mystical Tutor": ["Tutor"], "Worldly Tutor": ["Tutor"] };
    staleIndex(); deckTab.c = "balance"; save(); go("decks", "c");
  }, cards);
  const box = async () => { await p.waitForFunction(() => document.querySelector("#brBox") && !/Checking/.test(document.querySelector("#brBox").textContent), null, { timeout: 8000 }); return p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ")); };
  await setDeck(["Sol Ring", "Counterspell"]); R.b2 = await box(); R.queries = qs.length;
  await setDeck(["Rhystic Study", "Farewell", "Time Warp"]); R.b3 = await box();
  await setDeck(GC); R.b4 = await box();
  await setDeck(["Armageddon"]); R.mld = await box();
  await setDeck(XT); R.xt = await box();
  await setDeck(["Vampiric Tutor", "Enlightened Tutor", "Mystical Tutor", "Worldly Tutor"]); R.tut = await box();
  R.queries2 = qs.length;
  // deck value history
  R.noHist = await p.$eval("#dPane", e => /value chart starts once prices have updated on two different days/.test(e.textContent));
  await p.evaluate(() => { const T = today(); S.decks.c.vh = [[T - 40, 20], [T - 10, 30], [T - 2, 25], [T, 8]]; renderDeck(S.decks.c); });
  R.hist = await p.$eval("#dPane", e => e.textContent.replace(/\s+/g, " ").match(/Deck value.*?Includes cards/)?.[0]);
  R.spark = !!(await p.$("#dPane svg.spark"));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.evaluate(async () => { S.meta.pricedAt = 0; await refreshPrices(true); });
  R.recorded = await p.evaluate(() => { const h = S.decks.c.vh; return [h.length, h.at(-1)[0] === today(), h.at(-1)[1]]; });
  // not a Commander deck: no bracket box
  await p.evaluate(() => { S.decks.c.format = "modern"; renderDeck(S.decks.c); }); R.noBox = !(await p.$("#brBox"));
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "bracket_phone.png"]]) {
    const R = await run(opts, shot);
    ok(/2 \(Core\) or lower/.test(R.b2) && /two-card combos/i.test(R.b2) && R.queries === 3, `${label}: nothing notable → 2 or lower, combos named as not checked (${R.queries} lookups)`);
    ok(/3 \(Upgraded\)/.test(R.b3) && /Game Changers \(2\): Rhystic Study, Farewell/.test(R.b3) && /Extra turns \(1\): Time Warp/.test(R.b3), `${label}: 2 Game Changers → 3, cards listed (${R.b3.slice(0, 160)})`);
    ok(/4 \(Optimized\) or higher/.test(R.b4) && /5 Game Changers \(bracket 3 allows up to 3\)/.test(R.b4), `${label}: 5 Game Changers → 4`);
    ok(/4 \(Optimized\)/.test(R.mld) && /mass land denial/.test(R.mld), `${label}: mass land denial → 4`);
    ok(/4 \(Optimized\)/.test(R.xt) && /4 extra-turn cards/.test(R.xt), `${label}: 4 extra-turn cards → 4`);
    ok(/3 \(Upgraded\)/.test(R.tut) && /4 tutors/.test(R.tut), `${label}: 4 tutors → 3`);
    ok(R.queries2 === 3, `${label}: the lists are loaded once and reused`);
    ok(R.noHist, `${label}: no value chart until there are two days of prices`);
    ok(R.hist && /−\$12\.00 since/.test(R.hist) && /7 days: −\$22\.00/.test(R.hist) && /30 days: −\$12\.00/.test(R.hist) && R.spark, `${label}: value chart with 7 and 30 day changes (${R.hist})`);
    ok(R.recorded[0] === 4 && R.recorded[1] && R.recorded[2] === 8, `${label}: Update prices records today's deck value ${JSON.stringify(R.recorded)}`);
    ok(R.noBox, `${label}: no bracket box for non-Commander decks`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
