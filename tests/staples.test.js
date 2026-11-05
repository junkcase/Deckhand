// Staples by set: pick a set, rank by Most played / Most valuable / Rising (30-day price rises from the daily job),
// plus the "Best cards in this set" shortcut from Set completion.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const id = n => `0000000${n}-0000-4000-8000-000000000000`;
const C = (n, name, set, usd, o = {}) => Object.assign({ object: "card", id: id(n), oracle_id: "o" + n, name, set, set_name: set.toUpperCase(), collector_number: String(n), rarity: "rare", type_line: "Creature", cmc: 2, mana_cost: "{1}{G}", colors: ["G"], color_identity: ["G"], prices: { usd: String(usd) }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal", standard: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } }, o);
const CARDS = [C(1, "Green Thing", "dsk", 3), C(2, "Blue Thing", "dsk", 12, { colors: ["U"], color_identity: ["U"], rarity: "mythic" }), C(3, "Old Thing", "m21", 1), C(4, "Banned Thing", "dsk", 40, { legalities: { commander: "banned", standard: "legal" } })];
const SETS = [{ code: "dsk", name: "Duskmourn", released_at: "2024-09-27", card_count: 286, printed_size: 276, set_type: "expansion", icon_svg_uri: "" },
  { code: "tdsk", name: "Duskmourn Tokens", released_at: "2024-09-27", card_count: 20, set_type: "token", icon_svg_uri: "" },
  { code: "m21", name: "Core Set 2021", released_at: "2020-07-03", card_count: 397, printed_size: 274, set_type: "core", icon_svg_uri: "" }];
const RISING = { "all": [[id(3), "m21", 300, 100, 0], [id(2), "dsk", 1500, 1200, 0], [id(4), "dsk", 4000, 2000, 0]], "dsk": [[id(2), "dsk", 1500, 1200, 0], [id(4), "dsk", 4000, 2000, 0]] };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8797", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], searches = [], posts = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/history/")[1] || "", m = k.match(/^rising\/(\w+)\.json$/), d = m && RISING[m[1]];
    r.fulfill({ status: d ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: d ? JSON.stringify(d) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.endsWith("/sets")) return J({ data: SETS });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers.map(x => x.id); posts.push(ids.length); return J({ data: CARDS.filter(c => ids.includes(c.id)), not_found: [] }); }
    if (u.includes("/cards/search")) { searches.push(u.split("search?")[1]); const set = (u.match(/ e:(\w+)/) || [])[1];
      let list = CARDS.filter(c => (!set || c.set === set) && c.legalities.commander === "legal"); if (/order=usd/.test(u)) list = list.slice().sort((a, b) => b.prices.usd - a.prices.usd);
      return list.length ? J({ data: list, has_more: false }) : J({ details: "none" }, 404); }
    return J({}, 404); });
  await p.goto("http://127.0.0.1:8797/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { sv.mode = "staples"; go("search"); }); await p.waitForTimeout(700);
  const R = {}, names = async () => { await p.waitForSelector("#stList .item, #stList p", { timeout: 5000 }).catch(() => {}); return p.$$eval("#stList .item .name", a => a.map(x => x.textContent.replace(/^\s*\d+\.\s*/, "").trim())); };
  R.setOpts = await p.$$eval("#stSet option", a => a.map(x => x.textContent));
  R.rank = await p.$$eval("#stRank button", a => a.map(x => x.textContent + (x.getAttribute("aria-pressed") === "true" ? "*" : "")));
  await p.selectOption("#stSet", "dsk"); await p.waitForTimeout(1500);
R.played = await names(); R.q1 = searches.at(-1); R.note = await p.$eval("#sres .small.muted", e => e.textContent);
  await p.click('#stRank [data-rank="value"]'); await p.waitForTimeout(1500); R.value = await names(); R.q2 = searches.at(-1);
  await p.click('#stRank [data-rank="rising"]'); await p.waitForTimeout(600); R.rising = await names(); R.roleHidden = !(await p.$("#stRole"));
  R.riseMeta = await p.$eval("#stList .item .meta", e => e.textContent.replace(/\s+/g, " ").trim());
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  await p.click('#stCol [data-col="g"]'); await p.waitForTimeout(200); R.risingGreen = await p.$eval("#stList", e => e.textContent.trim());
  await p.click('#stCol [data-col="all"]'); await p.selectOption("#stSet", ""); await p.waitForTimeout(600); R.risingAll = await names();
  R.saved = await p.evaluate(() => [S.meta.staples.set, S.meta.staples.rank]);
  // Set completion → Best cards in this set
  await p.evaluate(() => { stp.rank = "edhrec"; stp.role = "ramp"; const c = { id: "x1", oid: "o", name: "Green Thing", set: "dsk", setName: "Duskmourn", num: "1", rarity: "rare", type: "Creature", cmc: 2, colors: ["G"], ci: ["G"], img: "", prices: { usd: "3" }, finishes: ["nonfoil"] };
    addToColl(c, "nonfoil", 1, defaultBinder()); go("coll"); }); await p.waitForTimeout(300);
  await p.evaluate(() => setDetail("dsk", () => {})); await p.waitForTimeout(300); await p.click("#sdBest"); await p.waitForTimeout(1500);
  R.jump = await p.evaluate(() => [tab, sv.mode, document.querySelector("#stSet").value, stp.role, !!document.querySelector(".sheet.open, #sheet.open")]); R.jumpList = await names();
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.posts = posts; R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "staples_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.setOpts[0] === "Any set" && R.setOpts.some(t => /^Duskmourn \(DSK\) · 2024$/.test(t)) && !R.setOpts.some(t => /Tokens/.test(t)), `[${label}] set picker: Any set, real sets, no token sets ${JSON.stringify(R.setOpts)}`);
    ok(R.rank.join("|") === "Most played*|Most valuable|Rising", `[${label}] Rank by: Most played (default), Most valuable, Rising`);
    ok(/e:dsk/.test(R.q1) && /order=edhrec/.test(R.q1) && R.played.join() === "Green Thing,Blue Thing", `[${label}] picking a set searches just that set (${R.q1})`);
    ok(/from Duskmourn/.test(R.note), `[${label}] says which set (${R.note})`);
    ok(/order=usd&dir=desc/.test(R.q2) && R.value.join() === "Blue Thing,Green Thing", `[${label}] Most valuable sorts by price, high first`);
    ok(R.rising.join() === "Blue Thing" && R.roleHidden, `[${label}] Rising: the set's risers that are Commander-legal (banned card left out); deck types hidden ${JSON.stringify(R.rising)}`);
    ok(/\$15\.00/.test(R.riseMeta) && /\+\$3\.00 \(\+25%\) in 30 days/.test(R.riseMeta), `[${label}] shows the rise (${R.riseMeta})`);
    ok(/Nothing rising matches/.test(R.risingGreen), `[${label}] colour filter applies to Rising`);
    ok(R.risingAll.join() === "Old Thing,Blue Thing", `[${label}] Any set: the overall risers ${JSON.stringify(R.risingAll)}`);
    ok(R.saved.join() === ",rising", `[${label}] choices are remembered`);
    ok(R.jump[0] === "search" && R.jump[1] === "staples" && R.jump[2] === "dsk" && R.jump[3] === "all" && R.jumpList.join() === "Green Thing,Blue Thing", `[${label}] Set completion → Best cards in this set opens Staples for that set ${JSON.stringify(R.jump)}`);
    ok(R.posts.every(n => n <= 75), `[${label}] card details fetched in batches of up to 75`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
