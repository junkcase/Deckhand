// Market tab: speculation watchlist. Predictions lock when saved; results come only from real recorded prices.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const DAY = Math.floor(Date.now() / 864e5), H = d => d - 18262;              // history days are counted from 2020-01-01
const HIST = { "aaa-up": { t: [[H(DAY - 40), 1000], [H(DAY - 20), 1300], [H(DAY - 2), 1250]] }, "aab-down": { t: [[H(DAY - 40), 1000], [H(DAY - 9), 1100]] } };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8806", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1];
    const body = k === "history/meta.json" ? { as_of: new Date(DAY * 864e5).toISOString().slice(0, 10) } : k === "history/aaa.json" ? { "aaa-up": HIST["aaa-up"] } : k === "history/aab.json" ? { "aab-down": HIST["aab-down"] } : null;
    r.fulfill({ status: body ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: body ? JSON.stringify(body) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8806/app_real.html"); await p.waitForTimeout(500);
  const card = (id, name, usd) => ({ id, oid: "o" + id, name, set: "cmm", setName: "Commander Masters", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: String(usd), usd_foil: null }, finishes: ["nonfoil"] });
  const R = {};
  R.tabs = await p.$$eval("nav.tabs button", a => a.map(x => x.textContent.trim()));
  // watch a card from its screen
  await p.evaluate(c => openCard(c, "nonfoil"), card("aaa-up", "Rising Card", 10)); await p.waitForTimeout(200);
  await p.click("#cWatch"); await p.waitForSelector("#spSave");
  await p.click("#spSave"); R.err1 = await p.$eval("#spErr", e => e.textContent);
  await p.click('#spDir [data-d="up"]'); await p.click("#spSave"); R.err2 = await p.$eval("#spErr", e => e.textContent);
  await p.click('#spH [data-h="30"]'); await p.click("#spSave"); R.err3 = await p.$eval("#spErr", e => e.textContent);
  await p.fill("#spWhy", "New commander makes it a staple"); await p.fill("#spIn", "9"); await p.fill("#spOut", "12"); await p.fill("#spNote", "bought 2"); await p.click("#spSave"); await p.waitForTimeout(300);
  R.saved = await p.evaluate(() => { const x = Object.values(S.spec)[0]; return { tab, dir: x.pred.dir, days: x.pred.days, start: x.pred.start, entry: x.pred.entry, exit: x.pred.exit, why: x.reason, notes: x.notes.length, track: x.track.length, at: !!x.pred.at }; });
  R.list = await p.$eval("#view .list", e => e.textContent.replace(/\s+/g, " "));
  await p.click("#view [data-spec]"); await p.waitForTimeout(200);
  R.detail = await p.$eval("#spD", e => e.textContent.replace(/\s+/g, " "));
  R.editable = await p.$$eval("#spD input, #spD textarea", a => a.map(x => x.id));             // only the note box
  await p.fill("#spN", "price is climbing"); await p.click("#spNGo"); R.notes = await p.evaluate(() => Object.values(S.spec)[0].notes.map(n => n.text));
  await p.evaluate(() => closeSheet());
  // the same call, made 40 days ago (as if it had been saved then), is judged from the real recorded prices
  await p.evaluate(([up, down, nodata]) => { const now = Date.now(), ago = d => now - d * 864e5;
    const mkS = (c, dir, days, start, at, extra = {}) => { const id = uid(); S.spec[id] = Object.assign({ id, card: c, finish: "nonfoil", created: at, updated: at, status: "active", reason: "test", notes: [], pred: { dir, days, entry: null, exit: null, start, at }, track: [] }, extra); return id; };
    S.spec = {};
    mkS(up, "up", 30, 10, ago(40), { pred: { dir: "up", days: 30, entry: 9, exit: 12, start: 10, at: ago(40) } });   // 10 → 13 by day 30: right, sell target reached
    mkS(down, "down", 30, 10, ago(40));                                                                          // 10 → 10 (rose to 11 later): missed
    mkS(nodata, "up", 7, 5, ago(20));                                                                             // no prices recorded at all: no result
    const ab = mkS(down, "up", 7, 10, ago(40)); S.spec[ab].status = "abandoned";                                  // abandoned: doesn't count
    mkS(up, "flat", 365, 10, ago(10));                                                                           // still running
    save(); go("market"); }, [card("aaa-up", "Rising Card", 12.5), card("aab-down", "Falling Card", 11), card("zzz-none", "Quiet Card", 5)]);
  await p.waitForTimeout(800);
  R.rows = await p.$$eval("#view .list .item", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  R.record = await p.$eval("#view .box", e => e.textContent.replace(/\s+/g, " "));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  await p.click('#mkF [data-f="abandoned"]'); await p.waitForTimeout(100); R.abandoned = await p.$$eval("#view .list .item", a => a.length);
  await p.click('#mkF [data-f="active"]'); await p.waitForTimeout(100);
  await p.evaluate(() => { const b = [...document.querySelectorAll("#view [data-spec]")].find(x => /Rising Card/.test(x.textContent) && /Called it/.test(x.textContent)); b.click(); }); await p.waitForTimeout(200);
  R.upDetail = await p.$eval("#spD", e => e.textContent.replace(/\s+/g, " "));
  await p.click('#spSt [data-s="completed"]'); R.status = await p.evaluate(() => Object.values(S.spec).filter(x => x.status === "completed").length);
  await p.evaluate(() => closeSheet());
  R.sync = await p.evaluate(() => { const base = pickSync(S), L = JSON.parse(JSON.stringify(base)), Rm = JSON.parse(JSON.stringify(base)); L.spec.a = { id: "a", updated: 1 }; Rm.spec.b = { id: "b", updated: 2 }; const m = mergeSync(base, L, Rm); return SYNC_V >= 4 && SYNC_KEYS.includes("spec") && !!m.spec.a && !!m.spec.b; });
  R.record2 = await p.evaluate(() => { const x = Object.values(S.spec).find(x => x.card.id === "zzz-none" && x.status === "active"); x.card.prices.usd = "5.5"; specRecord(x); return x.track.length; });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "market_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.tabs.join("|") === "Collection|Scan|Search|Decks|Trade|Market", `[${label}] a Market tab ${JSON.stringify(R.tabs)}`);
    ok(/which way/.test(R.err1) && /time frame/.test(R.err2) && /why/.test(R.err3), `[${label}] direction, time frame and reason are required (${R.err1} / ${R.err2} / ${R.err3})`);
    ok(R.saved.tab === "market" && R.saved.dir === "up" && R.saved.days === 30 && R.saved.start === 10 && R.saved.entry === 9 && R.saved.exit === 12 && R.saved.notes === 1 && R.saved.track === 1 && R.saved.at, `[${label}] saved with today's price and date ${JSON.stringify(R.saved)}`);
    ok(/Rising Card/.test(R.list) && /▲ Up/.test(R.list) && /Buy \$9\.00/.test(R.list) && /Sell \$12\.00/.test(R.list) && /30 days to go/.test(R.list), `[${label}] listed in Market (${R.list.slice(0, 120)})`);
    ok(/🔒 Locked/.test(R.detail) && /Up over 1 month/.test(R.detail) && /from \$10\.00/.test(R.detail) && /Still within the time frame/.test(R.detail), `[${label}] the prediction is shown as locked; no result before the time is up`);
    ok(JSON.stringify(R.editable) === '["spN"]', `[${label}] the prediction can't be edited: only a new note can be added ${JSON.stringify(R.editable)}`);
    ok(JSON.stringify(R.notes) === '["bought 2","price is climbing"]', `[${label}] dated notes`);
    const row = (n, dir) => R.rows.find(r => r.includes(n) && r.includes(dir) && !/Abandoned/.test(r)) || "";
    ok(/Called it · \+30%/.test(row("Rising Card", "▲ Up")) && /Sell \$12\.00 ✓/.test(row("Rising Card", "▲ Up")), `[${label}] Up call judged from real history: $10 → $13 by the end → called it, sell target reached (${row("Rising Card", "▲ Up")})`);
    ok(/Missed · \+0%/.test(row("Falling Card", "▼ Down")), `[${label}] Down call that stayed flat → missed (${row("Falling Card", "▼ Down")})`);
    ok(/No price recorded at the end/.test(row("Quiet Card", "▲ Up")), `[${label}] no recorded prices → no result instead of a made-up one (${row("Quiet Card", "▲ Up")})`);
    ok(/1 of 2 called the direction right/.test(R.record) && /sell target reached 1 of 1/.test(R.record), `[${label}] record counts only finished, real results; abandoned and still-running calls left out (${R.record.slice(0, 120)})`);
    ok(R.abandoned === 1, `[${label}] Abandoned filter`);
    ok(/Called it\. On .* it was \$13\.00: \+30\.0%/.test(R.upDetail) && /Sell at \$12\.00: reached/.test(R.upDetail), `[${label}] result details (${R.upDetail.match(/Result.{0,120}/)})`);
    ok(R.status === 1, `[${label}] mark as completed`);
    ok(R.sync, `[${label}] watchlist syncs (new sync version)`);
    ok(R.record2 === 1, `[${label}] each price update records that day's price`);
    ok(!R.overflow, `[${label}] no sideways scrolling with six tabs`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
