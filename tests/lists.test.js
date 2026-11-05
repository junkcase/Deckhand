// Search → Lists: paste a list (here, text copied from a Mana Pool list page), go through the cards one at a time,
// add or skip; unfinished lists show as Incoming (not in the collection yet), with a reminder on the Collection tab.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
let n = 0; const C = (name, set, num, usd, o = {}) => Object.assign({ object: "card", id: "c" + (++n) + "-" + set, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase() + " set", collector_number: num, released_at: "2024-01-01", rarity: "rare", type_line: "Creature",
  cmc: 3, mana_cost: "{2}{R}", colors: ["R"], color_identity: ["R"], prices: { usd: String(usd), usd_foil: String(usd * 3) }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } }, o);
const ALL = [C("Kira Nerys, Firebrand", "fic", "10", 0.76), C("Koth, the Geomancer", "fic", "11", 0.17), C("Pia, Aether Ascetic", "fic", "12", 0.26), C("Pyre Rhymer // Molten Tide", "fic", "13", 0.25, { card_faces: [{ name: "Pyre Rhymer" }, { name: "Molten Tide" }] }),
  C("Voracious Bibliophile", "fic", "14", 0.24), C("U.S.S. Enterprise-D, Galaxy-Class", "fic", "15", 2.16, { type_line: "Artifact" }), C("Sol Ring", "cmm", "410", 1.5, { rarity: "uncommon" }), C("Sol Ring", "ltc", "284", 2, { rarity: "uncommon" }), C("Lightning Bolt", "2x2", "117", 1, { rarity: "uncommon" })];
const PASTE = `39 CARDS
CREATURES (37)
4x Kira Nerys, Firebrand $0.76
11x Koth, the Geomancer $0.17
9x Pia, Aether Ascetic $0.26
5x Pyre Rhymer // Molten Tide $0.25
8x Voracious Bibliophile $0.24
ARTIFACTS (2)
2x U.S.S. Enterprise-D, Galaxy-Class $2.16
1 Sol Ring (CMM) 410 *F*
Lightnng Bolt
Zzzz Nothing Card`;
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8800", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (!u.includes("api.scryfall.com")) return J({}, 404);
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST" } });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers, data = [], nf = [];
      for (const i of ids) { const c = ALL.find(c => i.collector_number ? c.set === i.set && c.collector_number === i.collector_number : (c.name === i.name || c.name.startsWith(i.name + " //")) && (!i.set || c.set === i.set)); c ? data.push(c) : nf.push(i); }
      return J({ data, not_found: nf }); }
    let m = u.match(/named\?fuzzy=([^&]+)/); if (m) { const q = m[1].toLowerCase().replace(/[^a-z]/g, ""); const c = ALL.find(c => { const nm = c.name.toLowerCase().replace(/[^a-z]/g, ""); return nm === q || (q.length > 6 && nm.startsWith(q.slice(0, 5)) && Math.abs(nm.length - q.length) <= 2); }); return c ? J(c) : J({ details: "No card" }, 404); }
    if (u.includes("unique=prints")) { const nm = (u.match(/!"([^"]+)"/) || [])[1]; return J({ data: ALL.filter(c => c.name === nm), has_more: false }); }
    if (u.endsWith("/sets")) return J({ data: [] });
    return J({}, 404); });
  await p.goto("http://127.0.0.1:8800/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" }, bulk: { id: "bulk", name: "Bulk box" }, wish: { id: "wish", name: "Wishlist", wish: true } }; S.meta.binder = "main"; save(); });
  const R = {};
  R.parsed = await p.evaluate(t => parseListText(t).map(x => `${x.qty}|${x.name}|${x.set || ""}|${x.num || ""}|${x.finish}`), PASTE);
  await p.evaluate(() => { sv.mode = "lists"; go("search"); }); await p.waitForTimeout(300);
  R.seg = await p.$$eval("#sMode button", a => a.map(x => x.textContent.trim()));
  await p.fill("#lsName", "Mana Pool order"); await p.fill("#lsText", PASTE); await p.check("#lsOrder"); await p.click("#lsGo");
  await p.waitForSelector(".lstep", { timeout: 20000 }).catch(async () => { console.log("DBG", await p.$eval("#sres", e => e.textContent.replace(/\s+/g, " ").slice(0, 600)), JSON.stringify(errs)); }); await p.waitForTimeout(200);
  const view = () => p.evaluate(() => ({ head: document.querySelector("#sres h2").textContent, chip: (document.querySelector("#sres .row .chip") || {}).textContent, note: [...document.querySelectorAll("#sres > .stack > .small.muted")].map(x => x.textContent).join(" "),
    step: (document.querySelector(".lstep .label") || {}).textContent, name: (document.querySelector(".lstep .name") || {}).textContent, missing: [...document.querySelectorAll(".lFix")].map(x => x.value), guess: (document.querySelector(".lstep .gold") || {}).textContent || "" }));
  R.v1 = await view();
  R.coll0 = await p.evaluate(() => Object.keys(S.coll).length);
  await p.click("#lInc"); await p.click("#lAdd"); await p.waitForTimeout(150);           // 5 Kira
  R.v2 = await view(); R.toast = await p.$eval("#toastRoot", e => e.textContent);
  await p.click("#lSkip"); await p.waitForTimeout(100);                                    // skip Koth
  await p.click("#lPrev"); await p.waitForTimeout(100); R.prev = await view();
  await p.click("#lNext"); await p.waitForTimeout(100);
  await p.selectOption("#lBin", "bulk"); await p.click('#lFin [data-f="foil"]'); await p.waitForTimeout(100); await p.click("#lAdd"); await p.waitForTimeout(100);   // 9 foil Pia → Bulk box
  if (shot) { await p.$eval(".lstep", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot }); }
  R.after3 = await p.evaluate(() => Object.values(S.coll).map(e => `${e.name}×${e.qty}/${e.finish}/${e.binder}`).sort());
  // the Collection tab reminds you about incoming cards
  await p.evaluate(() => go("coll")); await p.waitForTimeout(200);
  R.banner = await p.$eval("#inNote", e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
  await p.click("#inGo"); await p.waitForTimeout(300); R.back = await view();
  // the misread line: type the right name
  await p.fill('.lFix[data-fix]', "Lightning Bolt"); await p.press('.lFix[data-fix]', "Enter"); await p.waitForTimeout(800); R.fixed = await view();
  // add all the rest, then undo
  const left0 = await p.evaluate(() => listLeft(Object.values(S.lists)[0]));
  await p.click("#lAll"); await p.waitForTimeout(150); R.allColl = await p.evaluate(() => Object.values(S.coll).reduce((a, e) => a + e.qty, 0)); R.allView = await view();
  await p.click("#toastAct"); await p.waitForTimeout(150); R.undo = await p.evaluate(() => [Object.values(S.coll).reduce((a, e) => a + e.qty, 0), listLeft(Object.values(S.lists)[0])]);
  await p.click("#lAll"); await p.waitForTimeout(150);
  await p.evaluate(() => go("coll")); await p.waitForTimeout(200); R.bannerGone = !(await p.$("#inNote"));
  await p.evaluate(() => { sv.mode = "lists"; lv.open = null; go("search"); }); await p.waitForTimeout(200);
  R.index = await p.$$eval("#sres h2.sec", a => a.map(x => x.textContent));
  R.synced = await p.evaluate(() => { const base = pickSync(S), L = JSON.parse(JSON.stringify(base)), Rm = JSON.parse(JSON.stringify(base));
    L.lists.a = { id: "a", name: "From phone", updated: 1, items: [] }; Rm.lists.b = { id: "b", name: "From tablet", updated: 2, items: [] };
    const m = mergeSync(base, L, Rm); return SYNC_KEYS.includes("lists") && SYNC_V >= 3 && !!m.lists.a && !!m.lists.b; });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.left0 = left0; R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "lists_phone.png"]]) {
    const R = await run(opts, shot);
    ok(JSON.stringify(R.parsed) === JSON.stringify(["4|Kira Nerys, Firebrand|||nonfoil", "11|Koth, the Geomancer|||nonfoil", "9|Pia, Aether Ascetic|||nonfoil", "5|Pyre Rhymer // Molten Tide|||nonfoil", "8|Voracious Bibliophile|||nonfoil", "2|U.S.S. Enterprise-D, Galaxy-Class|||nonfoil", "1|Sol Ring|cmm|410|foil", "1|Lightnng Bolt|||nonfoil", "1|Zzzz Nothing Card|||nonfoil"]),
      `[${label}] reads Mana Pool's copied list: "4x", prices, headings and "39 CARDS" skipped, commas in names kept, *F* = foil ${JSON.stringify(R.parsed)}`);
    ok(R.seg.join("|") === "Search cards|Staples|Lists", `[${label}] Search has a Lists button ${JSON.stringify(R.seg)}`);
    ok(R.v1.head === "Mana Pool order" && /Incoming · order/.test(R.v1.chip) && /aren't in your collection until you add them/.test(R.v1.note) && R.coll0 === 0, `[${label}] new list opens as Incoming, nothing in the collection yet ${JSON.stringify(R.v1)}`);
    ok(R.v1.step === "Card 1 of 8" && R.v1.name === "Kira Nerys, Firebrand" && JSON.stringify(R.v1.missing) === '["Zzzz Nothing Card"]', `[${label}] one card at a time (8 found, the typo matched by closest name); the unknown line is listed to fix ${JSON.stringify(R.v1)}`);
    ok(R.v2.name === "Koth, the Geomancer" && /Added 5 Kira Nerys, Firebrand to Collection/.test(R.toast), `[${label}] Add (with +1) adds and moves on (${R.toast})`);
    ok(R.prev.name === "Koth, the Geomancer", `[${label}] Back goes to the previous card (${R.prev.name})`);
    ok(JSON.stringify(R.after3) === JSON.stringify(["Kira Nerys, Firebrand×5/nonfoil/main", "Pia, Aether Ascetic×9/foil/bulk"]), `[${label}] finish and binder chosen per card; skipped card not added ${JSON.stringify(R.after3)}`);
    ok(/37 incoming cards/.test(R.banner) || /incoming cards? on “Mana Pool order”: not in your collection yet/.test(R.banner), `[${label}] Collection tab says what's incoming (${R.banner})`);
    ok(R.back.head === "Mana Pool order", `[${label}] "Review and add" opens the list`);
    ok(R.fixed.missing.length === 0, `[${label}] typing the right name fixes the missing line`);
    ok(R.allView.chip === "All done" && R.allColl === 5 + 9 + 5 + 8 + 2 + 1 + 1 + 1, `[${label}] Add all adds the rest (skipped Koth stays out) — ${R.allColl} cards`);
    ok(R.undo[0] === 14 && R.undo[1] === R.left0, `[${label}] Add all can be undone ${JSON.stringify(R.undo)}`);
    ok(R.bannerGone && JSON.stringify(R.index) === '["Finished"]', `[${label}] when everything's added the reminder goes and the list moves to Finished ${JSON.stringify(R.index)}`);
    ok(R.synced, `[${label}] lists sync between devices: lists made on two devices are both kept (new sync version, so older devices update first)`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
