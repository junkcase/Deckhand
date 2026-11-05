// Market → Opportunities: today's candidates from the data job, each with evidence, risks and data dates; no confidence scores.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const ID = "0aa0c3d1-1111-4222-8333-444455556666", today = new Date().toISOString().slice(0, 10);
const OPPS = { as_of: today, rankSince: today, fresh: { history: today, manapool: today + "T10:41:00Z", cardkingdom: today + "T06:00:00Z", scryfall: today }, strategies: {
  movers: [{ id: ID, name: "Mover Card", set: "cmm", setName: "Commander Masters", num: "12", fin: "nonfoil", price: 900, ch7: 80, ch30: 80, ev: ["TCGplayer market $5.00 a month ago → $9.00 now (+80%), +80% in the last week."], risk: ["Most of the rise came in the last week: recent jumps often settle back."] }],
  gaps: [{ id: ID, name: "Gap Card", set: "abc", setName: "ABC", num: "1", fin: "nonfoil", price: 300, ch7: 0, ch30: null, ev: ["Card Kingdom is paying $4.10 cash on its buylist; TCGplayer market is $3.00 (+37%)."], risk: [] }],
  played: [], lows: [], demand: [] } };
async function run(opts, shot, data) {
  const srv = spawn("python3", ["-m", "http.server", "8808", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1].split("?")[0];
    r.fulfill({ status: k === "opps/all.json" && data ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: k === "opps/all.json" && data ? JSON.stringify(data) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*" };
    if (u.includes("/cards/" + ID)) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ object: "card", id: ID, oracle_id: "o", name: "Mover Card", set: "cmm", set_name: "Commander Masters", collector_number: "12", rarity: "rare", type_line: "Artifact", cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: "9.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } }) });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8808/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => go("market")); await p.waitForTimeout(200);
  const R = {};
  await p.click('#mkV [data-v="opps"]'); await p.waitForTimeout(700);
  R.text = await p.$eval("#opV", e => e.textContent.replace(/\s+/g, " "));
  if (!data) { R.errs = errs; await b.close(); srv.kill(); return R; }
  R.chips = await p.$$eval("#opS button", a => a.map(x => x.textContent.trim()));
  R.cards = await p.$$eval("#opV .opp", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  R.img = await p.$eval("#opV .opp img", e => e.getAttribute("src"));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  await p.click('#opS [data-s="demand"]'); await p.waitForTimeout(100); R.demand = await p.$eval("#opV", e => e.textContent.replace(/\s+/g, " "));
  await p.click('#opS [data-s="movers"]'); await p.waitForTimeout(100);
  await p.click("#opV [data-owatch]"); await p.waitForSelector("#spSave", { timeout: 5000 }); R.watch = await p.$eval("#spBody h2", e => e.textContent);
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(200);
  R.view = await p.evaluate(() => MKT.view);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "opps_phone.png"]]) {
    const R = await run(opts, shot, OPPS);
    ok(R.chips.join("|") === "All|Big movers 1|Store price gaps 1|Played a lot 0|90-day lows 0|Rising demand 0", `[${label}] strategies with counts ${JSON.stringify(R.chips)}`);
    ok(R.cards.length === 2 && /Mover Card/.test(R.cards[0]) && /Commander Masters · CMM #12/.test(R.cards[0]) && /\$9\.00 TCGplayer market · 7 days \+80% · 30 days \+80%/.test(R.cards[0]), `[${label}] card, printing, price and movement: ${R.cards[0].slice(0, 140)}`);
    ok(/Evidence: TCGplayer market \$5\.00 a month ago → \$9\.00/.test(R.cards[0]) && /Risks: ?Most of the rise came in the last week/.test(R.cards[0]), `[${label}] evidence and risks shown`);
    ok(/Evidence: Card Kingdom is paying \$4\.10/.test(R.cards[1]) && /30 days —/.test(R.cards[1]), `[${label}] a missing number shows as — rather than a guess`);
    ok(/Data: TCGplayer market prices and history through MTGJSON \(Today\), Mana Pool \(Today\), Card Kingdom buylist \(Today\), printings and EDHREC ranks from Scryfall \(Today\)/.test(R.text) && /no confidence score because no tested model/.test(R.text), `[${label}] data freshness and no confidence score`);
    ok(!/undervalued|confidence: \d|will rise/i.test(R.text), `[${label}] no "undervalued" or prediction claims`);
    ok(/needs a month of daily EDHREC ranks/.test(R.demand) && /rather than treating price moves as demand/.test(R.demand), `[${label}] rising demand explains why it's empty instead of using price moves`);
    ok(R.watch === "Watch Mover Card", `[${label}] Watch this opens the watchlist form`);
    ok(/cards\.scryfall\.io\/small\/front\/0\/a\//.test(R.img), `[${label}] card picture from Scryfall`);
    ok(R.view === "opps", `[${label}] stays on Opportunities`);
    ok(!R.overflow && !R.errs.length, `[${label}] no sideways scrolling, no errors ${JSON.stringify(R.errs)}`);
  }
  const N = await run({ viewport: { width: 1280, height: 900 } }, null, null);
  ok(/haven't been worked out yet/.test(N.text) && !N.errs.length, `before the first daily run: says so (${N.text.trim()})`);
})();
