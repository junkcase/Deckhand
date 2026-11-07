// Price alerts: rules (above/below/target/%), fire once per crossing, edit/pause/delete, history, bulk, old-alert conversion.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PRICE = { a: 10, b: 2, c: null };
const card = id => ({ object: "card", id, oracle_id: "o" + id, name: { a: "Alpha Card", b: "Beta Card", c: "Gamma Card" }[id], set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: PRICE[id] == null ? null : String(PRICE[id]) }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } });
async function run(ctxOpts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8778", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", d => { errs.push("dialog " + d.message()); d.dismiss(); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => {
    const u = r.request().url();
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers.filter(x => x.id).map(x => x.id).filter(id => PRICE.hasOwnProperty(id));
      return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ object: "list", data: ids.map(card), not_found: [] }) }); }
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" });
  });
  await p.goto("http://127.0.0.1:8778/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  // ---- an old-style alert converts without losing anything
  R.mig = await p.evaluate(() => { S.alerts["zz|nonfoil"] = { name: "Old Card", prices: { usd: "4" }, below: 5, above: 20, hitAt: Date.now() - 864e5, hitPrice: 4, seen: false }; migrate();
    const a = S.alerts["zz|nonfoil"]; return { rules: a.rules.map(r => [r.kind, r.v, r.armed]), log: a.log.map(l => [l.price, l.seen, l.text]), keptOld: a.below === 5 && a.above === 20 }; });
  // ---- engine
  await p.evaluate(C => { S.binders.main = { id: "main", name: "Collection" }; for (const c of C) addToColl(slim(c), "nonfoil", 1, "main"); save(); }, ["a", "b", "c"].map(card));
  R.eng = await p.evaluate(() => {
    const k = "a|nonfoil", e = Object.values(S.coll).find(x => x.id === "a"), set = v => { e.prices = { usd: String(v) }; };
    const a = alertRecord(k, e); const add = r => { const b = bindRule(Object.assign({ id: uid(), on: true }, r), alertPrice(k, a)); a.rules.push(b); return b; };
    const above = add({ kind: "above", v: 12 }), pct = add({ kind: "pct", v: 30, dir: "either" }), tgt = add({ kind: "target", v: 15 }), below = add({ kind: "below", v: 11 });
    const out = { pctBase: pct.base, tgtDir: tgt.dir, belowArmed: below.armed };
    const fired = () => a.log.map(l => l.text.split(" ")[0] + (l.text.includes("%") ? "%" : "") + "@" + l.price).join(",");
    set(12.5); checkAlerts(); out.s1 = fired();            // above 12 + pct +25% fire
    checkAlerts(); out.s2 = fired();                        // same price again: nothing new
    set(11.5); checkAlerts(); out.s3 = fired();            // drops back: re-arms, nothing fires (below 11 not reached)
    set(12.2); checkAlerts(); out.s4 = fired();            // crosses 12 again: above fires again; pct still under 20%
    set(15); checkAlerts(); out.s5 = fired();              // target 15 reached, pct +50% re-fires (it re-armed at 11.5)
    set(6.9); checkAlerts(); out.s6 = fired();             // −21%: pct fires; below 11 fires
    out.unseen = unseenAlerts().length; return out;
  });
  // ---- end to end: Update prices with the real refresh path
  await p.evaluate(() => { const e = Object.values(S.coll).find(x => x.id === "b"); const a = alertRecord("b|nonfoil", e); a.rules.push(bindRule({ id: uid(), kind: "above", v: 3, on: true }, 2)); save(); go("coll"); });
  PRICE.b = 3.5; PRICE.a = 7.9;
  await p.click("#cMoreMenu > summary").then(() => p.click("#cRefresh")); await p.waitForFunction(() => !refreshing, null, { timeout: 15000 }); await p.waitForTimeout(300);
  R.e2e = await p.evaluate(() => ({ log: S.alerts["b|nonfoil"].log.map(l => l.price), banner: [...document.querySelectorAll(".box.alert .kv")].map(x => x.textContent.replace(/\s+/g, " ").trim()).filter(t => t.includes("Beta")) }));
  PRICE.b = 3.5; await p.click("#cMoreMenu > summary").then(() => p.click("#cRefresh")); await p.waitForFunction(() => !refreshing, null, { timeout: 15000 });
  R.e2eAgain = await p.evaluate(() => S.alerts["b|nonfoil"].log.length);
  // OK on the banner marks it seen
  const okBtn = await p.$('.box.alert [data-seen="b|nonfoil"]'); if (okBtn) await okBtn.click(); await p.waitForTimeout(150);
  R.seen = await p.evaluate(() => S.alerts["b|nonfoil"].log.every(l => l.seen));
  // ---- card sheet: add, edit, pause, resume, delete
  await p.evaluate(() => { const e = Object.values(S.coll).find(x => x.id === "c"); openCard(e, "nonfoil", "main"); }); await p.waitForTimeout(200);
  R.noPriceShown = await p.$eval("#alBox", b => b.textContent.includes("No price yet") && b.textContent.includes("TCGplayer market price, via Scryfall"));
  await p.selectOption("#afKind", "pct"); await p.fill("#afV", "10"); await p.click("#aSave"); await p.waitForTimeout(150);
  R.pctNoPrice = await p.evaluate(() => [!S.alerts["c|nonfoil"], document.querySelector("#toastRoot").textContent]);
  await p.evaluate(() => { closeSheet(); const e = Object.values(S.coll).find(x => x.id === "b"); openCard(e, "nonfoil", "main"); }); await p.waitForTimeout(200);
  R.srcLine = await p.$eval("#alBox", b => /TCGplayer market price, via Scryfall, updated/.test(b.textContent) && /Triggered: .* at \$3\.50/.test(b.textContent));
  await p.selectOption("#afKind", "below"); await p.fill("#afV", "1"); await p.click("#aSave"); await p.waitForTimeout(150);
  const rid = await p.evaluate(() => S.alerts["b|nonfoil"].rules.at(-1).id);
  await p.click(`#alBox [data-ced="${rid}"]`); await p.waitForTimeout(100);
  R.editPre = await p.evaluate(() => [document.querySelector("#afKind").value, document.querySelector("#afV").value, document.querySelector("#aSave").textContent]);
  await p.fill("#afV", "1.5"); await p.click("#aSave"); await p.waitForTimeout(150);
  R.edited = await p.evaluate(id => { const r = S.alerts["b|nonfoil"].rules.find(x => x.id === id); return r && [r.kind, r.v, S.alerts["b|nonfoil"].rules.length]; }, rid);
  await p.click(`#alBox [data-con="${rid}"]`); await p.waitForTimeout(100);
  R.paused = await p.evaluate(id => { const a = S.alerts["b|nonfoil"], r = a.rules.find(x => x.id === id); const e = Object.values(S.coll).find(x => x.id === "b"); e.prices = { usd: "1" }; const n = a.log.length; checkAlerts(); return [r.on, a.log.length - n, document.querySelector("#alBox").textContent.includes("paused")]; }, rid);
  await p.evaluate(() => { closeSheet(); const e = Object.values(S.coll).find(x => x.id === "b"); openCard(e, "nonfoil", "main"); }); await p.waitForTimeout(150);
  await p.click(`#alBox [data-con="${rid}"]`); await p.waitForTimeout(100);
  R.resumed = await p.evaluate(id => { const a = S.alerts["b|nonfoil"], r = a.rules.find(x => x.id === id), n = a.log.length; checkAlerts(); return [r.on, r.armed, a.log.length - n]; }, rid);
  // already past the target when created: says so, waits for a crossing
  await p.selectOption("#afKind", "above"); await p.fill("#afV", "0.5"); await p.click("#aSave"); await p.waitForTimeout(150);
  R.already = await p.$eval("#toastRoot", t => t.textContent);
  await p.click(`#alBox [data-cdel="${rid}"]`); await p.waitForTimeout(100);
  R.deleted = await p.evaluate(id => !S.alerts["b|nonfoil"].rules.some(x => x.id === id), rid);
  await p.evaluate(() => closeSheet());
  // ---- all-alerts sheet
  await p.evaluate(() => go("coll")); await p.click("#cMoreMenu > summary").then(() => p.click("#cAlerts")); await p.waitForTimeout(200);
  R.sheet = await p.$eval("#alSheet", s => ({ active: s.querySelectorAll(".box").length, text: s.textContent.includes("Nothing is sent outside the app"), tab: s.querySelector('#alTabs [data-v="active"]').textContent }));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot.replace(".png", "_active.png"), fullPage: false });
  await p.click('#alTabs [data-v="hist"]'); await p.waitForTimeout(100);
  R.hist = await p.$$eval("#alSheet .mvrow", a => a.length);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: false });
  await p.click("#alSeen"); await p.waitForTimeout(100); R.allSeen = await p.evaluate(() => unseenAlerts().length);
  await p.click("#alClr"); await p.waitForTimeout(100); R.cleared = await p.$$eval("#alSheet .mvrow", a => a.length);
  await p.click("#toastAct"); await p.waitForTimeout(100); R.undone = await p.$$eval("#alSheet .mvrow", a => a.length);
  // pause from the sheet
  await p.click('#alTabs [data-v="active"]'); await p.waitForTimeout(100);
  await p.click("#alSheet [data-aon]"); await p.waitForTimeout(100); R.sheetPause = await p.$eval("#alSheet", s => s.textContent.includes("paused"));
  await p.evaluate(() => closeSheet());
  // ---- bulk from Select
  await p.click("#cSel"); await p.waitForTimeout(100); await p.click("#sAll"); await p.waitForTimeout(100);
  await p.click("#sAlert"); await p.waitForTimeout(150);
  R.bulkDefault = await p.$eval("#afKind", s => s.value);
  await p.fill("#afV", "25"); await p.click("#baGo"); await p.waitForTimeout(150);
  R.bulk = await p.evaluate(() => ({ toast: document.querySelector("#toastRoot").textContent, a: S.alerts["a|nonfoil"].rules.filter(r => r.kind === "pct" && r.v === 25).map(r => r.base), b: S.alerts["b|nonfoil"].rules.filter(r => r.kind === "pct" && r.v === 25).map(r => r.base), c: !!S.alerts["c|nonfoil"] }));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  // ---- hostile synced alert: escaped, junk rules dropped
  R.xss = await p.evaluate(() => { window.__x = 0; S.alerts["e\"><img src=x onerror=__x=1>|nonfoil"] = { name: "<img src=x onerror=__x=1>", set: "<b>", rules: [{ id: "\"><img src=x onerror=__x=1>", kind: "above", v: 1, on: true }, { kind: "evil", v: 1 }, null], log: [{ id: "x", at: 1, price: 1, text: "<img src=x onerror=__x=1>", seen: false }] };
    migrate(); go("coll"); alertsSheet("hist"); return S.alerts["e\"><img src=x onerror=__x=1>|nonfoil"].rules.length; });
  await p.waitForTimeout(300); R.xssFired = await p.evaluate(() => window.__x);
  await p.evaluate(() => { closeSheet(); alertsSheet(); }); await p.waitForTimeout(200); R.xssFired2 = await p.evaluate(() => window.__x);
  await p.evaluate(() => { closeSheet(); delete S.alerts["e\"><img src=x onerror=__x=1>|nonfoil"]; flushSave && flushSave(); }); await p.waitForTimeout(400);
  const before = await p.evaluate(() => JSON.stringify(S.alerts));
  await p.reload(); await p.waitForTimeout(900);
  R.reload = await p.evaluate(b => JSON.stringify(S.alerts) === b, before);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "alerts_phone.png"]]) {
    Object.assign(PRICE, { a: 10, b: 2, c: null });
    const R = await run(opts, shot), E = R.eng;
    ok(JSON.stringify(R.mig.rules) === '[["below",5,false],["above",20,true]]' && R.mig.log.length === 1 && R.mig.log[0][1] === false && R.mig.keptOld, `${label}: an old alert becomes two rules with its trigger kept in history ${JSON.stringify(R.mig)}`);
    ok(E.pctBase === 10 && E.tgtDir === "up" && E.belowArmed === false, `${label}: % starts from today's price; "reaches $15" from $10 means rising`);
    ok(E.s1 === "Rises@12.5", `${label}: crossing fires the matching rules ${E.s1}`);
    ok(E.s2 === E.s1, `${label}: the same price again doesn't alert twice`);
    ok(E.s3 === E.s1, `${label}: moving back re-arms quietly`);
    ok(E.s4 === E.s1 + ",Rises@12.2", `${label}: crossing again alerts again ${E.s4}`);
    ok(E.s5 === E.s4 + ",Up%@15,Reaches@15", `${label}: target reached and % fires after re-arming ${E.s5}`);
    ok(E.s6 === E.s5 + ",Up%@6.9,Falls@6.9", `${label}: a 31% drop and falling below fire ${E.s6}`);
    ok(R.e2e.log.join() === "3.5" && R.e2e.banner.length === 1 && /was \$3\.50/.test(R.e2e.banner[0]), `${label}: Update prices checks alerts and shows the banner ${JSON.stringify(R.e2e)}`);
    ok(R.e2eAgain === 1, `${label}: updating again at the same price doesn't repeat it`);
    ok(R.seen, `${label}: OK on the banner marks it seen`);
    ok(R.noPriceShown, `${label}: a card with no price says so, and the source is named`);
    ok(R.pctNoPrice[0] && /no price yet/.test(R.pctNoPrice[1]), `${label}: a % alert on an unpriced card is refused with a reason`);
    ok(R.srcLine, `${label}: card shows source, last update time and trigger history`);
    ok(R.editPre.join() === "below,1,Save changes" && JSON.stringify(R.edited) === '["below",1.5,2]', `${label}: Edit loads the rule and saves it in place ${JSON.stringify([R.editPre, R.edited])}`);
    ok(R.paused.join() === "false,0,true", `${label}: a paused rule doesn't fire ${JSON.stringify(R.paused)}`);
    ok(R.resumed.join() === "true,false,0", `${label}: resuming while already past it doesn't fire at once ${JSON.stringify(R.resumed)}`);
    ok(/already \$1\.00/.test(R.already), `${label}: adding a rule that's already met says so (${R.already})`);
    ok(R.deleted, `${label}: delete removes the rule`);
    ok(R.sheet.active === 3 && R.sheet.text, `${label}: All alerts lists each card with alerts ${JSON.stringify(R.sheet)}`);
    ok(R.hist >= 8, `${label}: history lists every trigger (${R.hist})`);
    ok(R.allSeen === 0 && R.cleared === 0 && R.undone === R.hist, `${label}: mark all seen, clear history, undo`);
    ok(R.sheetPause, `${label}: pause works from All alerts`);
    ok(R.bulkDefault === "pct" && R.bulk.a.join() === "7.9" && R.bulk.b.join() === "1" && !R.bulk.c && /2 cards; 1 skipped/.test(R.bulk.toast), `${label}: bulk alert uses each card's own price and skips unpriced ${JSON.stringify(R.bulk)}`);
    ok(R.xss === 1 && !R.xssFired && !R.xssFired2, `${label}: hostile synced alert is escaped and junk rules dropped`);
    ok(R.reload, `${label}: alerts survive a refresh unchanged`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no errors in the console ${JSON.stringify(R.errs)}`);
  }
})();
