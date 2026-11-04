// Buy what's missing: same count as the deck's "Not owned", prices, cheapest printings, TCGplayer list, wishlist.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (id, name, usd, o = {}) => Object.assign({ object: "card", id, oracle_id: "o" + id, name, set: "cmm", set_name: "CMM", collector_number: id.length + "", rarity: "rare", type_line: "Artifact", cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: usd == null ? null : String(usd) }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` } }, o);
const CHEAPEST = { "Mana Crypt": C("c9-mc2", "Mana Crypt", 120, { set: "2xm", collector_number: "270" }), "Smothering Tithe": C("st2", "Smothering Tithe", 18, { set: "rna" }), "Pyroblast": C("py2", "Pyroblast", 1.1, { set: "ice" }) };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8784", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [], searches = [];
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8784" });
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  let mpUp = true;
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/manapool/**", r => { const f = r.request().url().split("/").pop();
    if (!mpUp) return r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "404" });
    const D = { "meta.json": { as_of: "2026-11-03T03:00:00Z", cards: 3 }, "c2.json": { "c2-crypt": [15000, 16000, null, null, "cmm/5/mana-crypt"] }, "c9.json": { "c9-mc2": [11000, 11500, null, null, "2xm/270/mana-crypt"] }, "d3.json": { "d3-tithe": [2000, 2100, null, null, "cmm/9/smothering-tithe"] } };
    r.fulfill({ status: D[f] ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: D[f] ? JSON.stringify(D[f]) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/cards/search")) { if (u.includes("usd>0")) searches.push(u); const nm = (u.match(/!"([^"]+)"/) || [])[1]; const c = CHEAPEST[nm];
      return c ? r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ object: "list", data: [c], has_more: false, total_cards: 1 }) })
        : r.fulfill({ status: 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ object: "error", details: "No cards found" }) }); }
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8784/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(Cs => {
    S.binders = { main: { id: "main", name: "Collection" }, wish: { id: "wish", name: "Wishlist", wish: true } };
    const [sol, crypt, tithe, forest, pyro, odd, sig] = Cs.map(slim);
    addToColl(sol, "nonfoil", 1, "main"); addToColl(sig, "nonfoil", 1, "main");                 // own 1 Sol Ring, 1 Arcane Signet
    const d = S.decks.d = { id: "d", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
    addToDeck(d, sol, 1, false); addToDeck(d, crypt, 1, false); addToDeck(d, tithe, 1, false); addToDeck(d, forest, 9, false); addToDeck(d, pyro, 2, true); addToDeck(d, odd, 1, false); addToDeck(d, sig, 1, false);
    const e = S.decks.e = { id: "e", name: "Other", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; addToDeck(e, sig, 1, false);     // the one Signet is also in another deck
    save(); go("decks", "d");
  }, [C("a1-sol", "Sol Ring", 1.5), C("c2-crypt", "Mana Crypt", 180), C("d3-tithe", "Smothering Tithe", 22), C("f4-for", "Forest", 0.1, { type_line: "Basic Land — Forest", rarity: "common" }), C("b5-pyro", "Pyroblast", 2), C("e6-odd", "<img src=x onerror=__x=1> Card", null), C("a7-sig", "Arcane Signet", 0.5)]);
  await p.waitForTimeout(300);
  const R = {}; await p.evaluate(() => window.__x = 0);
  R.tile = await p.$eval("#dBuy", e => e.textContent.replace(/\s+/g, " "));
  await p.click("#dBuy"); await p.waitForTimeout(200);
  const names = () => p.$$eval("#buyBody .list .name", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  const sum = () => p.$$eval("#buyBody .summary b", a => a.map(x => x.textContent));
  await p.waitForTimeout(300);
  R.list = await names(); R.sum = await sum();
  R.mp = await p.$eval("#buyBody .box", e => e.textContent.replace(/\s+/g, " "));
  R.mpLinks = await p.$$eval("#buyBody .mplink", a => a.map(x => [x.textContent.trim(), x.href, x.target]));
  await p.click("#bySide"); await p.waitForTimeout(100); R.noSide = await names();
  await p.click("#bySide"); await p.click("#byBasic"); await p.waitForTimeout(100); R.withBasic = await names(); await p.click("#byBasic"); await p.waitForTimeout(100);
  const t0 = Date.now(); await p.click("#byFind"); await p.waitForFunction(() => !document.querySelector("#byFind"), null, { timeout: 15000 }).catch(() => {});
  R.findMs = Date.now() - t0; await p.waitForTimeout(300);
  R.mp2 = await p.$eval("#buyBody .box", e => e.textContent.replace(/\s+/g, " ")); R.mpLinks2 = await p.$$eval("#buyBody .mplink", a => a.map(x => x.textContent.trim())); R.sum2 = await sum(); R.searches = searches.length;
  R.rows = await p.$$eval("#buyBody .list .item", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click("#byCopy"); await p.waitForTimeout(200); R.clip = await p.evaluate(() => navigator.clipboard.readText());
  R.link = await p.$eval('#buyBody a[href*="tcgplayer"]', a => [a.href, a.target]);
  await p.click("#byWish"); await p.waitForTimeout(150); R.wish = await p.evaluate(() => Object.values(S.coll).filter(e => e.binder === "wish").map(e => e.name + "×" + e.qty).sort());
  await p.click("#byWish"); await p.waitForTimeout(150); R.wish2 = await p.evaluate(() => Object.values(S.coll).filter(e => e.binder === "wish").reduce((a, e) => a + e.qty, 0)); R.wishToast = await p.$eval("#toastRoot", e => e.textContent);
  // one copy per deck: the Signet used by the other deck now counts as missing
  await p.evaluate(() => { closeSheet(); S.settings.shareCopies = false; render(); }); await p.waitForTimeout(150);
  R.tileOff = await p.$eval("#dBuy b", e => e.textContent); await p.click("#dBuy"); await p.waitForTimeout(150); R.listOff = await names();
  // the old Deck options button opens the same sheet
  await p.evaluate(() => { closeSheet(); S.settings.shareCopies = true; render(); }); await p.click("#dMenu"); await p.waitForTimeout(150); await p.click("#miss"); await p.waitForTimeout(150); R.fromMenu = !!(await p.$("#buyBody h2"));
  // all owned: tile isn't a button and the sheet says so
  await p.evaluate(() => { closeSheet(); const d = S.decks.d; for (const k of Object.keys(d.cards)) if (!/sol|sig/.test(k)) delete d.cards[k]; S.settings.shareCopies = true; render(); }); await p.waitForTimeout(150);
  R.allOwned = !(await p.$("#dBuy"));
  // Mana Pool copy missing: says so, the rest still works
  mpUp = false; await p.evaluate(() => { MP.meta = null; MP.shards = {}; S.decks.d.cards["c2-crypt|0"] = Object.assign({}, Object.values(S.coll)[0], { id: "c2-crypt", name: "Mana Crypt", qty: 1, side: false }); closeSheet(); render(); });
  await p.click("#dBuy"); await p.waitForTimeout(500); R.mpDown = await p.$eval("#buyBody .box", e => e.textContent.replace(/\s+/g, " "));
  R.xss = await p.evaluate(() => window.__x); R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "buy_phone.png"]]) {
    const R = await run(opts, shot);
    ok(/Not owned\s*14/.test(R.tile) && /Buy what's missing/.test(R.tile), `${label}: the deck's Not owned number (14) opens Buy what's missing (${R.tile})`);
    ok(JSON.stringify(R.list) === JSON.stringify(["1× <img src=x onerror=__x=1> Card", "1× Mana Crypt", "2× Pyroblast sideboard", "1× Smothering Tithe"]), `${label}: lists only what you're short, sideboard marked, basics left out ${JSON.stringify(R.list)}`);
    ok(R.sum[0] === "5" && R.sum[1] === "$206.00" && R.sum[2] === "—", `${label}: count and cost at the deck's printings ${JSON.stringify(R.sum)}`);
    ok(R.noSide.length === 3 && R.withBasic.some(n => /9× Forest/.test(n)), `${label}: sideboard and basic-land switches`);
    ok(R.searches === 4 && R.sum2[2] === "$140.20" && R.findMs < 6000, `${label}: cheapest printings found (${R.searches} lookups, ${R.findMs} ms) and totalled ${JSON.stringify(R.sum2)}`);
    ok(R.rows.some(t => /Mana Crypt.*cheapest \$120\.00 · 2XM/.test(t)) && R.rows.some(t => /Card.*no price.*no cheaper printing found/.test(t)), `${label}: each card shows its cheapest printing, or says none was found`);
    ok(R.clip === "1 <img src=x onerror=__x=1> Card\n1 Mana Crypt\n2 Pyroblast\n1 Smothering Tithe", `${label}: copies a TCGplayer Mass Entry list ${JSON.stringify(R.clip)}`);
    ok(R.link[0] === "https://www.tcgplayer.com/massentry" && R.link[1] === "_blank", `${label}: links to TCGplayer Mass Entry in a new tab`);
    ok(R.wish.join() === "<img src=x onerror=__x=1> Card×1,Mana Crypt×1,Pyroblast×2,Smothering Tithe×1" && R.wish2 === 5 && /already/.test(R.wishToast), `${label}: wishlist gets them once, not twice ${JSON.stringify(R.wish)}`);
    ok(R.tileOff === "15" && R.listOff.includes("1× Arcane Signet"), `${label}: with one copy per deck, a card used by another deck counts as missing`);
    ok(R.fromMenu, `${label}: Deck options → Buy what's missing opens the same list`);
    ok(R.allOwned, `${label}: when you own everything there's nothing to tap`);
    ok(/Mana Pool lowest listing, prices from/.test(R.mp) && /\$170\.00/.test(R.mp) && /2 cards aren't listed on Mana Pool/.test(R.mp), `${label}: Mana Pool total for the deck's printings, unlisted cards called out (${R.mp.slice(0, 160)})`);
    ok(R.mpLinks.length === 2 && R.mpLinks[0][0] === "Mana Pool $150.00 ↗" && R.mpLinks[0][1] === "https://manapool.com/card/cmm/5/mana-crypt" && R.mpLinks[0][2] === "_blank", `${label}: each card links to its Mana Pool page ${JSON.stringify(R.mpLinks)}`);
    ok(/\$130\.00/.test(R.mp2) && R.mpLinks2.includes("Mana Pool $110.00 · 2XM ↗"), `${label}: after finding cheapest printings, Mana Pool uses the cheaper one when it has it ${JSON.stringify(R.mpLinks2)}`);
    ok(/Mana Pool prices aren't set up yet/.test(R.mpDown) && /Mana Pool.*—/.test(R.mpDown), `${label}: if the Mana Pool copy isn't there, it says so and nothing else breaks (${R.mpDown.slice(0, 120)})`);
    ok(!R.xss, `${label}: card names are shown as text`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
