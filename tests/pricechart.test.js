// Card screen price chart: up to a year of TCGplayer / Mana Pool / Card Kingdom buylist prices from the daily history files.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const END = Math.floor(Date.parse("2026-11-04") / 864e5) - 18262;     // as_of in history days (since 2020-01-01)
const DATA = {
  "history/meta.json": { as_of: "2026-11-04" },
  "history/a1b.json": { "a1b-crypt": {
    t: [[END - 300, 10000], [END - 60, 12000], [END - 20, 15000], [END, 15000]], tf: [[END - 40, 30000], [END, 31000]],
    kb: [[END - 300, 8000], [END - 10, 11000], [END, 11000]], m: [[END - 2, 14000], [END, 14500]] } },
};
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8795", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], asked = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1]; asked.push(k); r.fulfill({ status: DATA[k] ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: DATA[k] ? JSON.stringify(DATA[k]) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8795/app_real.html"); await p.waitForTimeout(500);
  const mk = (id, name) => ({ id, oid: "o" + id, name, set: "2xm", setName: "Double Masters", num: "270", rarity: "mythic", type: "Artifact", mana: "{0}", cmc: 0, colors: [], ci: [], img: "", prices: { usd: "150", usd_foil: "310" }, finishes: ["nonfoil", "foil"], leg: {}, layout: "normal" });
  await p.evaluate(c => { window.__c = c; openCard(c, "nonfoil"); }, mk("a1b-crypt", "Mana Crypt")); await p.waitForTimeout(600);
  const R = {};
  const look = () => p.evaluate(() => { const bx = document.querySelector("#phBox"); return bx && { shown: bx.style.display !== "none", head: bx.querySelector("#phRange") ? bx.querySelector("#phRange").textContent.replace(/\s+/g, " ").trim() : "", mv: bx.querySelector("#phMv") ? bx.querySelector("#phMv").textContent.replace(/\s+/g, " ").trim() : "",
    lines: [...bx.querySelectorAll("path.ln")].map(x => x.dataset.k).sort().join(","), range: (bx.querySelector("#phR [aria-pressed=true]") || {}).textContent, axis: bx.querySelector(".phc + .kv") ? bx.querySelector(".phc + .kv").textContent.replace(/\s+/g, " ").trim() : "",
    keys: [...bx.querySelectorAll("#phK button")].map(x => x.textContent.trim() + (x.getAttribute("aria-pressed") === "false" ? " (off)" : "")), local: !!document.querySelector(".spark") }; });
  R.first = await look();
  await p.click('#phR [data-r="1Y"]'); await p.waitForTimeout(150); R.year = await look();
  if (shot) { await p.$eval("#phBox", e => e.scrollIntoView()); await p.waitForTimeout(100); await (await p.$("#phBox")).screenshot({ path: __dirname + "/" + shot }); }
  await p.click('#phR [data-r="1W"]'); await p.waitForTimeout(150); R.week = await look();
  await p.click('#phK [data-k="m"]'); await p.waitForTimeout(150); R.noMp = await look();
  await p.click('#phK [data-k="m"]'); await p.waitForTimeout(150);
  await p.click('#phR [data-r="1M"]'); await p.waitForTimeout(150); R.month = await look();
  const bb = await p.$eval("#phC", e => { e.scrollIntoView(); const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  await p.mouse.move(bb[0] + bb[2] - 2, bb[1] + bb[3] / 2); await p.waitForTimeout(100); R.tipEnd = await p.$eval("#phTip", e => e.textContent.replace(/\s+/g, " ").trim());
  await p.mouse.move(bb[0] + 2, bb[1] + bb[3] / 2); await p.waitForTimeout(100); R.tipStart = await p.$eval("#phTip", e => e.textContent.replace(/\s+/g, " ").trim());
  await p.click('#finSeg [data-f="foil"]'); await p.waitForTimeout(200); R.foil = await look();
  R.savedRange = await p.evaluate(() => S.meta.phRange);
  // a card the history doesn't have: no chart, the device's own history still shows
  await p.evaluate(c => { closeSheet(); const k = pkey("ffe-none", "nonfoil"); S.ph[k] = [[today() - 3, 1], [today(), 2]]; openCard(c, "nonfoil"); }, mk("ffe-none", "Other Card")); await p.waitForTimeout(600);
  R.none = await look();
  R.files = [...new Set(asked)].sort();
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "pricechart_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.first.shown && R.first.range === "3M" && R.first.lines === "kb,m,t", `[${label}] chart shows on the card, 3 months, three stores ${JSON.stringify(R.first)}`);
    ok(/TCGplayer market over 3M: \+\$50\.00 \(\+50\.0%\) now \$150\.00/.test(R.first.head) && /High \$150\.00 · Low \$100\.00/.test(R.first.head), `[${label}] now, change over 3 months (price on the first day carried in), high and low (${R.first.head})`);
    ok(/TCGplayer market \$150\.00 was \$120\.00 until Oct 15/.test(R.first.mv) && /1 day ?\$0\.00 \(\+0\.0%\)/.test(R.first.mv) && /7 days ?\$0\.00/.test(R.first.mv) && /30 days ?\+\$30\.00 \(\+25\.0%\)/.test(R.first.mv) && /Source: TCGplayer market price, through MTGJSON/.test(R.first.mv) && /Last updated Nov 4/.test(R.first.mv), `[${label}] current, previous recorded price, 1/7/30-day changes, source and last update (${R.first.mv})`);
    ok(/\$310\.00 was \$300\.00 until Nov 4/.test(R.foil.mv) && /1 day ?\+\$10\.00 \(\+3\.3%\)/.test(R.foil.mv) && /30 days ?\+\$10\.00 \(\+3\.3%\)/.test(R.foil.mv), `[${label}] the same for foil (${R.foil.mv})`);
    ok(/\+\$50\.00 \(\+50\.0%\)/.test(R.year.head) && R.year.axis.startsWith("Nov 5"), `[${label}] 1Y reaches back a year (${R.year.axis})`);
    ok(/\+\$30\.00 \(\+25\.0%\)/.test(R.month.head) && /Low \$120\.00/.test(R.month.head), `[${label}] 1M: change over the month (${R.month.head})`);
    ok(/ \$0\.00 \(\+0\.0%\)/.test(R.week.head) && R.week.lines === "kb,m,t", `[${label}] 1W: flat for the week (${R.week.head})`);
    ok(R.noMp.lines === "kb,t" && R.noMp.keys.includes("Mana Pool lowest (off)"), `[${label}] tapping a store in the key hides its line ${JSON.stringify(R.noMp.keys)}`);
    ok(/TCGplayer market \$150\.00/.test(R.tipEnd) && /Mana Pool lowest \$145\.00/.test(R.tipEnd) && /Card Kingdom buys \$110\.00/.test(R.tipEnd), `[${label}] hovering the right edge shows today's prices (${R.tipEnd})`);
    ok(/TCGplayer market \$120\.00/.test(R.tipStart) && /Mana Pool lowest —/.test(R.tipStart) && /Card Kingdom buys \$80\.00/.test(R.tipStart), `[${label}] and a month ago, before Mana Pool was tracked (${R.tipStart})`);
    ok(R.foil.lines === "t" && /\$310\.00/.test(R.foil.head), `[${label}] foil switch shows the foil prices ${JSON.stringify(R.foil)}`);
    ok(R.savedRange === "1M", `[${label}] the range you picked is remembered`);
    ok(R.none && !R.none.shown && R.none.local, `[${label}] no history for a card: chart hidden, your own price history still shows`);
    ok(JSON.stringify(R.files) === '["history/a1b.json","history/ffe.json","history/meta.json"]', `[${label}] loads only the small files it needs ${JSON.stringify(R.files)}`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
