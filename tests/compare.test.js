// Compare decks: two decks side by side (basics, curve, land odds, goldfish speed, roles, bracket, combos, shared cards).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const COMBOS = { as_of: "2026-11-05T00:00:00Z", cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts"], feats: ["Infinite tokens"], tmpl: [], combos: [["1-2", [0, 1], [0], [], 100, "R"]] };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8805", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1], body = k === "combos/meta.json" ? { as_of: COMBOS.as_of } : k === "combos/all.json" ? COMBOS : null;
    r.fulfill({ status: body ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: body ? JSON.stringify(body) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*" };
    if (u.includes("is:gamechanger")) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: [{ name: "Mana Vault" }], has_more: false }) });
    if (u.includes("otag:")) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: [], has_more: false }) });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8805/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => {
    const mk = (id, name, type, cmc, qty, roles = [], price = 1) => ({ id, name, type, cmc, qty, set: "x", num: "1", img: "", prices: { usd: String(price) }, finishes: ["nonfoil"], leg: { commander: "l" }, roles, ci: ["R"], colors: ["R"] });
    const deck = (id, name, parts, cm) => { const cards = {}; for (const c of [...parts, cm]) cards[c.id + "|0"] = c; S.decks[id] = { id, name, format: "commander", cmdr: [cm.id + "|0"], cards, created: 1, updated: 1 }; };
    deck("fast", "Kiki Combo", [mk("l", "Mountain", "Basic Land — Mountain", 0, 33), mk("r", "Mana Vault", "Artifact", 1, 1, ["Ramp"], 40), mk("r2", "Fire Diamond", "Artifact", 2, 10, ["Ramp"]), mk("zc", "Zealous Conscripts", "Creature", 5, 1), mk("s", "Sol Ring", "Artifact", 1, 1, ["Ramp"]), mk("d", "Faithless Looting", "Sorcery", 1, 20, ["Card draw"]), mk("x", "Lightning Bolt", "Instant", 1, 33, ["Removal"])], mk("kj", "Kiki-Jiki, Mirror Breaker", "Legendary Creature", 5, 1));
    deck("slow", "Big Dragons", [mk("l", "Mountain", "Basic Land — Mountain", 0, 36), mk("s", "Sol Ring", "Artifact", 1, 1, ["Ramp"]), mk("dr", "Shivan Dragon", "Creature", 6, 40), mk("x", "Lightning Bolt", "Instant", 1, 22, ["Removal"])], mk("ur", "The Ur-Dragon", "Legendary Creature", 9, 1));
    save(); go("decks"); });
  await p.waitForTimeout(300);
  const R = {};
  await p.click("#ndCmp"); await p.waitForSelector("table.cmp"); await p.waitForTimeout(1800);      // bracket + combo lists arrive
  const tbl = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("table.cmp tbody tr:not(.cmph)")].map(tr => { const td = [...tr.children].map(x => x.textContent.trim()); return [td[0], [td[1], td[2], tr.children[1].classList.contains("cmpw") ? "A" : tr.children[2].classList.contains("cmpw") ? "B" : ""]]; })));
  R.t = await tbl(); R.heads = await p.$$eval("table.cmp thead th", a => a.map(x => x.textContent));
  R.shared = await p.$eval("#cmpBody details summary", e => e.textContent); await p.click("#cmpBody details summary"); R.sharedList = await p.$eval("#cmpBody details p", e => e.textContent);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  await p.click("#cmpSwap"); await p.waitForTimeout(200); R.swapped = await p.$$eval("table.cmp thead th", a => a.map(x => x.textContent));
  await p.click("#cmpOpenB"); await p.waitForTimeout(300); R.opened = await p.evaluate(() => [tab, deckOpen]);
  // from a deck's options
  await p.click("#dMenu, #dOpt, [id^=dOpt]").catch(async () => { await p.evaluate(() => deckOptions && deckOptions(S.decks.fast)); });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "compare_phone.png"]]) {
    const R = await run(opts, shot), t = R.t;
    ok(R.heads.join("|") === "|Big Dragons|Kiki Combo" || R.heads.join("|") === "|Kiki Combo|Big Dragons", `[${label}] two decks side by side ${JSON.stringify(R.heads)}`);
    const A = R.heads[1], fastIs = A === "Kiki Combo" ? "A" : "B";
    ok(t["Cards (main)"][0] === "100" && t["Cards (main)"][1] === "100" && t["Lands"].join() === (fastIs === "A" ? "33,36," : "36,33,"), `[${label}] basics, no "winner" for neutral counts like lands ${JSON.stringify([t["Cards (main)"], t["Lands"]])}`);
    ok(t["4 mana by turn"][2] === fastIs && t["Commander out by turn"][2] === fastIs, `[${label}] the rocks deck is faster to 4 mana and its commander comes out sooner, marked in bold ${JSON.stringify([t["4 mana by turn"], t["Commander out by turn"]])}`);
    ok(t["Average mana value"][2] === fastIs, `[${label}] lower average mana value marked ${JSON.stringify(t["Average mana value"])}`);
    ok(t["Ramp"] && t["Removal"] && t["Card draw"], `[${label}] card roles compared ${JSON.stringify([t["Ramp"], t["Removal"], t["Card draw"]])}`);
    ok(/^3/.test(t["Bracket (estimate)"][fastIs === "A" ? 0 : 1]) && /^2/.test(t["Bracket (estimate)"][fastIs === "A" ? 1 : 0]) && t["Known combos in the deck"].join() === (fastIs === "A" ? "1,0," : "0,1,"), `[${label}] bracket (Game Changer + two-card combo → 3) and combos fill in once loaded ${JSON.stringify([t["Bracket (estimate)"], t["Known combos in the deck"]])}`);
    ok(/3 cards in both decks/.test(R.shared) && R.sharedList === "Lightning Bolt · Mountain · Sol Ring", `[${label}] cards in both decks (${R.shared}: ${R.sharedList})`);
    ok(R.swapped[1] === R.heads[2] && R.swapped[2] === R.heads[1], `[${label}] Swap sides`);
    ok(R.opened[0] === "decks" && !!R.opened[1], `[${label}] open either deck from the comparison`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
