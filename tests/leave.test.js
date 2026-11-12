// Leaving the page (reload, another site, closing the tab) straight after a change, before the 250 ms save has run.
// In a real browser the database write started as the page goes is not guaranteed to finish; the change must survive anyway.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const URL_ = "http://127.0.0.1:8893/app_real.html";
const sol = { id: "sol", oracle_id: "o-sol", name: "Sol Ring", set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: {} };
const total = p => p.evaluate(() => Object.values(S.coll).reduce((a, e) => a + e.qty, 0));
async function scenario(label, leave) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-leave-"));
  const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1000, height: 800 } });
  await c.route("https://**", r => r.fulfill({ status: 404, body: "" }));
  let p = c.pages()[0] || await c.newPage();
  await p.goto(URL_); await p.waitForTimeout(800);
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 3, "main"); save(); }, sol); await p.waitForTimeout(600);      // saved and settled: 3
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 2, "main"); save(); }, sol);                                   // 5, save still pending
  p = await leave(c, p);
  await p.goto(URL_); await p.waitForTimeout(800);
  const n = await total(p);
  ok(n === 5, `${label}: the change is still there afterwards (${n} of 5 copies)`);
  // and the stray localStorage copy is tidied away once the database has it
  await p.evaluate(sol => { addToColl(slim(sol), "nonfoil", 1, "main"); save(); }, sol); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(800);
  ok(await total(p) === 6 && await p.evaluate(() => !localStorage.getItem("deckhand.v1")), `${label}: later saves carry on normally in the database`);
  await c.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}
// The same through the buttons people actually use (search-result quick add, the card sheet's quantity and Add button,
// the +/− on a copy you own), with a small collection and with one too big to fit in localStorage whole (about 9 MB).
const mk = (i, name) => ({ object: "card", id: "id-" + i, oracle_id: "o-" + i, name: name || "Card Number " + i, set: "s" + (i % 90), set_name: "Set Name Number " + (i % 90), collector_number: String(i), rarity: "uncommon", type_line: "Legendary Creature — Human Wizard", cmc: 3, mana_cost: "{1}{U}{B}", colors: ["U", "B"], color_identity: ["U", "B"], released_at: "2023-08-04", oracle_text: "Flying, lifelink. Whenever this creature deals combat damage to a player, draw a card, then discard a card. ".repeat(2),
  prices: { usd: "1.50", usd_foil: "4.00", eur: "1.2" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal", modern: "legal", legacy: "legal", vintage: "legal", pioneer: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/id-${i}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/id-${i}.jpg` } });
const TARGET = mk(999999, "Duty Beyond Death");
async function ui(label, seedN, how) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dh-leave-"));
  const c = await chromium.launchPersistentContext(dir, { viewport: { width: 1100, height: 850 } });
  await c.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  // what the two stores hold at the very start of the next page load, before the app touches them
  await c.addInitScript(() => { const q = st => st && st.coll ? Object.values(st.coll).filter(e => e.name === "Duty Beyond Death").reduce((a, e) => a + e.qty, 0) : null;
    const at = window.__atStart = { whole: false, note: false, db: "?" };
    try { at.whole = !!localStorage.getItem("deckhand.v1"); at.note = !!localStorage.getItem("deckhand.v1.leave"); } catch (e) {}
    try { const o = indexedDB.open("deckhand", 1); o.onupgradeneeded = () => o.result.createObjectStore("kv"); o.onsuccess = () => { const g = o.result.transaction("kv").objectStore("kv").get("state"); g.onsuccess = () => { at.db = q(g.result); }; }; } catch (e) {} });
  const p = c.pages()[0] || await c.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  const dbd = () => p.evaluate(() => Object.values(S.coll).filter(e => e.name === "Duty Beyond Death").reduce((a, e) => a + e.qty, 0));
  await p.goto(URL_); await p.waitForTimeout(800);
  await p.evaluate(({ n, mkSrc, T, pre }) => { const mk = eval(mkSrc); for (let i = 0; i < n; i++) addToColl(slim(mk(i)), "nonfoil", 1 + (i % 3), "main", true, { imported: true }); if (pre) addToColl(slim(T), "nonfoil", pre, "main", true); save(); }, { n: seedN, mkSrc: "(" + mk.toString() + ")", T: TARGET, pre: how.pre || 0 });
  await p.waitForTimeout(seedN > 1000 ? 2500 : 700);
  const size = await p.evaluate(() => JSON.stringify(S).length);
  await p.evaluate(T => { sv.mode = "search"; go("search"); sv.results = [T]; sv.ran = true; sv.q = "duty"; drawResults(); }, TARGET); await p.waitForTimeout(400);
  if (how.kind === "quick") for (let i = 0; i < how.n; i++) await p.click('#sres [data-qa="0"]');
  else if (how.kind === "sheet") { await p.click("#sres .tile"); await p.waitForSelector("#cPlus"); for (let i = 1; i < how.n; i++) await p.click("#qInc"); await p.click("#cPlus"); }
  else { await p.click("#sres .tile"); await p.waitForSelector("[data-oinc]"); await p.waitForTimeout(600); for (let i = 0; i < how.n; i++) await p.click(how.n > 0 && how.kind === "own-" ? "[data-odec]" : "[data-oinc]"); }
  const want = (how.pre || 0) + (how.kind === "own-" ? -how.n : how.n), mem = await dbd();
  await p.reload(); await p.waitForTimeout(1500);
  const at = await p.evaluate(() => window.__atStart), after = await dbd();
  ok(mem === want && after === want && !errs.length, `${label} (${(size / 1e6).toFixed(1)} MB of data): ${after} after the reload, should be ${want} [at the next start: database had ${at.db}, change note ${at.note ? "yes" : "no"}, whole copy ${at.whole ? "yes" : "no"}]${errs.length ? " errors: " + errs[0] : ""}`);
  if (seedN > 5000) ok(at.note && !at.whole, `${label}: with a collection too big for localStorage, the change came back from the small note`);
  await p.reload(); await p.waitForTimeout(1200);
  ok(await dbd() === want && await p.evaluate(() => !localStorage.getItem("deckhand.v1.leave") && !localStorage.getItem("deckhand.v1")), `${label}: still right after another reload, nothing left over in localStorage`);
  await c.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8893", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  try {
    await scenario("reload at once", async (c, p) => { await p.reload(); return p; });
    await scenario("go to another page at once", async (c, p) => { await p.goto("about:blank"); return p; });
    await scenario("close the tab at once", async (c, p) => { const keep = await c.newPage(); await p.close({ runBeforeUnload: true }); return keep; });
    for (const n of [50, 9000]) {
      await ui(`${n} entries, a new card with the quick-add button, reload at once`, n, { kind: "quick", n: 1 });
      await ui(`${n} entries, a card you own (2) with the quick-add button`, n, { kind: "quick", n: 1, pre: 2 });
      await ui(`${n} entries, quick add tapped 3 times`, n, { kind: "quick", n: 3 });
      await ui(`${n} entries, card sheet: quantity 4 then Add`, n, { kind: "sheet", n: 4 });
      await ui(`${n} entries, card sheet: + twice on a copy you own (3)`, n, { kind: "own+", n: 2, pre: 3 });
      await ui(`${n} entries, card sheet: − on a copy you own (3)`, n, { kind: "own-", n: 1, pre: 3 });
    }
  } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
