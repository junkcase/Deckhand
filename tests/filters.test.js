// Collection filters: every filter alone and together, chips, clearing, decks, speed on a big collection, hostile data.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const L = (o) => Object.fromEntries(["commander", "standard", "pioneer", "modern", "legacy", "vintage", "pauper"].map(f => [f, o[f] || "not_legal"]));
const mk = (id, name, o) => Object.assign({ object: "card", id, oracle_id: "o" + name, name, set: "dom", set_name: "Dominaria", collector_number: "1", rarity: "common", type_line: "Artifact", cmc: 0, mana_cost: "", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil", "foil", "etched"], lang: "en",
  image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } }, o);
const CARDS = [
  [mk("A", "Llanowar Elves", { collector_number: "168", type_line: "Creature — Elf Druid", cmc: 1, colors: ["G"], color_identity: ["G"], prices: { usd: "0.30" }, legalities: L({ commander: "legal", modern: "legal", legacy: "legal" }) }), "nonfoil", 4],
  [mk("B", "Llanowar Elves", { set: "m19", set_name: "Core Set 2019", collector_number: "314", type_line: "Creature — Elf Druid", cmc: 1, colors: ["G"], color_identity: ["G"], prices: { usd: "0.25", usd_foil: "2.00" }, legalities: L({ commander: "legal", modern: "legal" }) }), "foil", 1],
  [mk("C", "Lightning Bolt", { set: "2xm", set_name: "Double Masters", collector_number: "141", rarity: "uncommon", type_line: "Instant", cmc: 1, colors: ["R"], color_identity: ["R"], prices: { usd: "1.50" }, lang: "ja", legalities: L({ commander: "legal", modern: "legal" }) }), "nonfoil", 2],
  [mk("D", "Teferi, Hero of Dominaria", { collector_number: "207", rarity: "mythic", type_line: "Legendary Planeswalker — Teferi", cmc: 5, colors: ["W", "U"], color_identity: ["W", "U"], prices: { usd: "12" }, legalities: L({ commander: "legal", modern: "legal" }) }), "nonfoil", 1],
  [mk("E", "Sol Ring", { set: "c21", set_name: "Commander 2021", collector_number: "263", rarity: "uncommon", cmc: 1, prices: { usd: "1.00" }, legalities: L({ commander: "legal", vintage: "restricted" }) }), "nonfoil", 3],
  [mk("F", "Azorius Signet", { set: "c21", set_name: "Commander 2021", collector_number: "236", rarity: "uncommon", cmc: 2, prices: { usd: null } }), "nonfoil", 1],
  [mk("G", "Atraxa, Praetors' Voice", { set: "2xm", set_name: "Double Masters", collector_number: "190", rarity: "mythic", type_line: "Legendary Creature — Phyrexian Angel Horror", cmc: 4, colors: ["W", "U", "B", "G"], color_identity: ["W", "U", "B", "G"], prices: { usd: "15", usd_etched: "20" }, legalities: L({ commander: "legal", legacy: "legal" }) }), "etched", 1],
];
async function run(ctxOpts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8780", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8780/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(C => {
    S.binders = { main: { id: "main", name: "Collection" }, wl: { id: "wl", name: "Wishlist", wish: true } };
    for (const [c, fin, q] of C) addToColl(slim(c), fin, q, "main");
    const sl = n => slim(C.find(x => x[0].name === n)[0]);
    addToColl(Object.assign(sl("Sol Ring"), { id: "W", name: "Ragavan" }), "nonfoil", 1, "wl");
    S.decks.d1 = { id: "d1", name: "Elves", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.d2 = { id: "d2", name: "Burn", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 };
    addToDeck(S.decks.d1, sl("Llanowar Elves"), 4, false); addToDeck(S.decks.d1, sl("Sol Ring"), 1, false); addToDeck(S.decks.d2, sl("Lightning Bolt"), 2, false); addToDeck(S.decks.d2, sl("Sol Ring"), 1, false);
    const sig = Object.values(S.coll).find(e => e.name === "Azorius Signet"); delete sig.leg;          // saved before legality was stored
    save(); go("coll");
  }, CARDS);
  await p.waitForTimeout(300);
  const R = {};
  R.before = await p.evaluate(() => JSON.stringify([S.coll, S.decks]));
  const names = () => p.$$eval("#clist .item .name", a => a.map(x => x.textContent).sort().join("|"));
  const apply = async (f, q = "") => { await p.evaluate(([f, q]) => { cv.q = q; cv.f = Object.assign(collDefaultF(), f); renderColl(); }, [f, q]); return names(); };
  const cases = [
    ["colors including G", { colors: ["G"] }, "Atraxa, Praetors' Voice|Llanowar Elves|Llanowar Elves"],
    ["colors exactly W U", { colors: ["W", "U"], cmode: "exact" }, "Teferi, Hero of Dominaria"],
    ["colors at most R G", { colors: ["R", "G"], cmode: "most" }, "Azorius Signet|Lightning Bolt|Llanowar Elves|Llanowar Elves|Sol Ring"],
    ["color identity within W U", { colors: ["W", "U"], cmode: "id" }, "Azorius Signet|Sol Ring|Teferi, Hero of Dominaria"],
    ["colorless", { colors: ["C"] }, "Azorius Signet|Sol Ring"],
    ["type Creature", { type: "Creature" }, "Atraxa, Praetors' Voice|Llanowar Elves|Llanowar Elves"],
    ["subtype elf", { sub: "elf" }, "Llanowar Elves|Llanowar Elves"],
    ["subtype words angel horror", { sub: "angel, horror" }, "Atraxa, Praetors' Voice"],
    ["type Legendary + Planeswalker word", { type: "Legendary", sub: "planeswalker" }, "Teferi, Hero of Dominaria"],
    ["rarity mythic", { rarity: ["mythic"] }, "Atraxa, Praetors' Voice|Teferi, Hero of Dominaria"],
    ["rarity common or uncommon", { rarity: ["common", "uncommon"] }, "Azorius Signet|Lightning Bolt|Llanowar Elves|Llanowar Elves|Sol Ring"],
    ["set DOM", { set: "dom" }, "Llanowar Elves|Teferi, Hero of Dominaria"],
    ["collector number 141", { num: "141" }, "Lightning Bolt"],
    ["collector number range 200-300", { num: "200-300" }, "Azorius Signet|Sol Ring|Teferi, Hero of Dominaria"],
    ["legal in Modern", { format: "modern" }, "Lightning Bolt|Llanowar Elves|Llanowar Elves|Teferi, Hero of Dominaria"],
    ["legal in Vintage (restricted counts)", { format: "vintage" }, "Sol Ring"],
    ["mana value 4 to 5", { mvMin: "4", mvMax: "5" }, "Atraxa, Praetors' Voice|Teferi, Hero of Dominaria"],
    ["price $1 to $2 (per copy, its own finish)", { priceMin: "1", priceMax: "2" }, "Lightning Bolt|Llanowar Elves|Sol Ring"],
    ["foil", { fin: ["foil"] }, "Llanowar Elves"],
    ["etched", { fin: ["etched"] }, "Atraxa, Praetors' Voice"],
    ["language JA", { lang: "ja" }, "Lightning Bolt"],
    ["own at least 3 (all printings)", { ownMin: "3" }, "Llanowar Elves|Llanowar Elves|Sol Ring"],
    ["own at most 1", { ownMax: "1" }, "Atraxa, Praetors' Voice|Azorius Signet|Teferi, Hero of Dominaria"],
    ["at least 1 not in decks", { availMin: "1" }, "Atraxa, Praetors' Voice|Azorius Signet|Llanowar Elves|Llanowar Elves|Sol Ring|Teferi, Hero of Dominaria"],
    ["in a deck", { asg: "in" }, "Lightning Bolt|Llanowar Elves|Llanowar Elves|Sol Ring"],
    ["not in any deck", { asg: "out" }, "Atraxa, Praetors' Voice|Azorius Signet|Teferi, Hero of Dominaria"],
    ["in the Burn deck", { deck: "d2" }, "Lightning Bolt|Sol Ring"],
    ["together: artifact + in Elves deck + legal in Commander", { type: "Artifact", deck: "d1", format: "commander" }, "Sol Ring"],
    ["together: green creature, mana value ≤1, foil", { colors: ["G"], type: "Creature", mvMax: "1", fin: ["foil"] }, "Llanowar Elves"],
  ];
  R.cases = []; for (const [label, f, want] of cases) R.cases.push([label, await apply(f), want]);
  R.textPlus = await apply({ rarity: ["mythic"] }, "teferi");
  R.chips = await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.dataset.fx));
  R.count = await p.$eval("#clist", e => e.textContent.match(/Showing 1 of 13 cards/) ? 1 : 0);
  R.none = await apply({ rarity: ["mythic"], fin: ["foil"] });
  R.noneMsg = await p.$eval("#clist", e => e.textContent.includes("No cards match these filters"));
  await p.click("#cfNone"); await p.waitForTimeout(150); R.afterNone = (await names()).split("|").length;
  R.noLeg = await (async () => { await apply({ format: "modern" }); await p.click("#cfTog"); await p.waitForTimeout(100); return p.$eval("#cfp", e => /1 card has no format information/.test(e.textContent)); })();
  // ---- the real controls
  await p.evaluate(() => { cv.f = collDefaultF(); cv.q = ""; cv.fOpen = false; renderColl(); });
  await p.click("#cfTog"); await p.waitForTimeout(100);
  await p.click('#cfCol [data-c="G"]'); await p.waitForTimeout(250);
  await p.selectOption('#cfp [data-k="type"]', "Creature"); await p.waitForTimeout(250);
  await p.click('#cfp [data-k="sub"]'); await p.keyboard.type("dru", { delay: 30 }); await p.waitForTimeout(300);
  R.focusKept = await p.evaluate(() => document.activeElement && document.activeElement.dataset.k === "sub" && document.activeElement.value === "dru");
  R.ui = await names(); R.uiChips = await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.textContent.trim()));
  R.tog = await p.$eval("#cfTog", e => e.textContent); R.matchN = await p.$eval("#cfN", e => e.textContent);
  if (shot) { await p.$eval("#cfTog", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot, fullPage: false }); }
  await p.click('#cfChips [data-fx="type"]'); await p.waitForTimeout(200);
  R.chipX = [await names(), await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.dataset.fx).join(","))];
  await p.click('#cfChips [data-fx="__all"]'); await p.waitForTimeout(200);
  R.clearAll = [(await names()).split("|").length, await p.$$eval("#cfChips [data-fx]", a => a.length), await p.$eval("#cfTog", e => e.textContent)];
  await p.click("#cfDone").catch(() => {}); await p.waitForTimeout(100); R.closed = await p.$eval("#cfp", e => e.hidden);
  // dashboard tile uses the same filters
  await p.click('#dash [data-dash="mythic"]'); await p.waitForTimeout(200);
  R.tile = [await names(), await p.$$eval("#cfChips [data-fx]", a => a.map(x => x.dataset.fx).join(","))];
  // wishlist binder
  await p.evaluate(() => { cv.binder = "wl"; cv.f = Object.assign(collDefaultF(), { type: "Artifact" }); renderColl(); }); R.wish = await names();
  await p.evaluate(() => { cv.binder = "all"; cv.f = collDefaultF(); renderColl(); });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.after = await p.evaluate(() => JSON.stringify([S.coll, S.decks]));
  // ---- hostile data in set names, languages and deck names
  R.xss = await p.evaluate(() => { window.__x = 0; const e = Object.values(S.coll)[0];
    S.coll.evil = Object.assign({}, e, { id: "evil", set: "x\"><img src=x onerror=__x=1>", setName: "<img src=x onerror=__x=1>", lang: "\"><img src=x onerror=__x=1>" });
    S.decks.evil = { id: "e\"><img src=x onerror=__x=1>", name: "<img src=x onerror=__x=1>", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 };
    cv.fOpen = true; cv.f = Object.assign(collDefaultF(), { set: "x\"><img src=x onerror=__x=1>", deck: "evil" }); renderColl(); return 1; });
  await p.waitForTimeout(300); R.xssFired = await p.evaluate(() => { delete S.coll.evil; delete S.decks.evil; cv.f = collDefaultF(); renderColl(); return window.__x; });
  R.errs = errs; await b.close(); srv.kill(); return R;
}
// speed: 6,000 entries, tablet-like CPU
async function speed() {
  const srv = spawn("python3", ["-m", "http.server", "8781", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(devices["Galaxy Tab S4"] || { viewport: { width: 712, height: 1138 } })).newPage();
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8781/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(C => { S.binders = { main: { id: "main", name: "Collection" } }; const types = ["Creature — Elf", "Instant", "Sorcery", "Artifact", "Legendary Creature — Human Wizard", "Land", "Enchantment — Aura"], cols = ["W", "U", "B", "R", "G"];
    for (let i = 0; i < 6000; i++) { const s = slim(Object.assign({}, C[i % C.length][0], { id: "id" + i, oracle_id: "o" + (i % 3000), name: "Card " + (i % 3000), collector_number: String(i % 400), set: "s" + (i % 60), set_name: "Set " + (i % 60), type_line: types[i % 7], colors: [cols[i % 5]], color_identity: [cols[i % 5]], cmc: i % 8, prices: { usd: String((i % 500) / 10) } }));
      S.coll["k" + i] = Object.assign(s, { finish: "nonfoil", qty: 1 + (i % 3), binder: "main", added: i }); }
    for (let d = 0; d < 15; d++) { S.decks["d" + d] = { id: "d" + d, name: "Deck " + d, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; for (let j = 0; j < 99; j++) { const s = Object.values(S.coll)[(d * 97 + j * 13) % 6000]; S.decks["d" + d].cards[s.id] = Object.assign({}, s, { qty: 1 }); } }
    staleIndex(); go("coll"); }, CARDS);
  await p.waitForTimeout(500);
  const cdp = await p.context().newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t = await p.evaluate(async () => {
    const out = {}, time = fn => { const a = performance.now(); fn(); return Math.round(performance.now() - a); };
    out.oneFilter = time(() => { cv.f = Object.assign(collDefaultF(), { type: "Creature" }); drawCollList(); });
    out.manyFilters = time(() => { cv.f = Object.assign(collDefaultF(), { colors: ["G", "U"], cmode: "most", type: "Creature", sub: "elf", mvMax: "4", priceMin: "1", priceMax: "40", ownMin: "1", availMin: "1", asg: "out", format: "commander" }); drawCollList(); });
    out.deckFilter = time(() => { cv.f = Object.assign(collDefaultF(), { deck: "d3" }); drawCollList(); });
    out.fullPage = time(() => { cv.f = Object.assign(collDefaultF(), { rarity: ["common"], num: "1-200" }); renderColl(); });
    out.n = cv.lastN; return out;
  });
  await b.close(); srv.kill(); return t;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, "filters_desktop.png"], ["phone", devices["Pixel 7"], "filters_phone.png"]]) {
    const R = await run(opts, shot);
    for (const [c, got, want] of R.cases) ok(got === want, `${label}: ${c}${got === want ? "" : ` → got ${got}, want ${want}`}`);
    ok(R.textPlus === "Teferi, Hero of Dominaria" && R.chips.join() === "q,rarity,__all" && R.count, `${label}: name box and filters work together; both show as chips with Clear all; "Showing 1 of 13 cards" ${JSON.stringify(R.chips)}`);
    ok(R.none === "" && R.noneMsg && R.afterNone === 7, `${label}: nothing matching says so, with Clear all that brings everything back`);
    ok(R.noLeg, `${label}: cards with no legality saved are left out and the panel says how many`);
    ok(R.focusKept, `${label}: typing in a filter box isn't interrupted as the list updates`);
    ok(R.ui === "Llanowar Elves|Llanowar Elves" && R.uiChips.length === 4 && R.tog === "Filters · 3" && /5 cards match/.test(R.matchN), `${label}: the panel's buttons, menus and text boxes filter the list live ${JSON.stringify([R.ui, R.uiChips, R.tog, R.matchN])}`);
    ok(R.chipX[0] === "Llanowar Elves|Llanowar Elves" && R.chipX[1] === "colors,sub,__all", `${label}: ✕ on one chip removes only that filter ${JSON.stringify(R.chipX)}`);
    ok(R.clearAll[0] === 7 && R.clearAll[1] === 0 && R.clearAll[2] === "Filters", `${label}: Clear all removes every filter ${JSON.stringify(R.clearAll)}`);
    ok(R.closed, `${label}: Done hides the panel`);
    ok(R.tile[0] === "Atraxa, Praetors' Voice|Teferi, Hero of Dominaria" && R.tile[1] === "rarity", `${label}: dashboard Mythics tile shows as a normal filter chip`);
    ok(R.wish === "Ragavan", `${label}: filters work inside a wishlist too, and wishlist cards stay out of All owned`);
    ok(R.before === R.after, `${label}: filtering never changes saved cards or decks`);
    ok(!R.xssFired, `${label}: hostile set, language and deck names are shown as text`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no errors in the console ${JSON.stringify(R.errs)}`);
  }
  const T = await speed();
  console.log("     speed, 6,000 entries, CPU slowed 4×:", JSON.stringify(T));
  ok(T.oneFilter < 400 && T.manyFilters < 400 && T.deckFilter < 400 && T.fullPage < 700, `big collection stays quick on a tablet-speed CPU (filter ${T.oneFilter} ms, many ${T.manyFilters} ms, deck ${T.deckFilter} ms, whole page ${T.fullPage} ms)`);
})();
