// Card details: "Used in decks" lists every deck that contains the card (by name, any printing: the rule the app already
// uses to match the collection with decks), with how many copies, and follows adds and removals made in the sheet.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const mk = (id, oid, name, set, num, type = "Artifact") => ({ object: "card", id, oracle_id: oid, name, set, set_name: set.toUpperCase() + " Set", collector_number: num, rarity: "uncommon", type_line: type, cmc: 1, mana_cost: "{1}", colors: [], color_identity: [],
  prices: { usd: "1.50", usd_foil: "4" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: `https://cards.scryfall.io/${id}.png`, normal: `https://cards.scryfall.io/${id}.png` } });
const C = { solA: mk("sol-cmm", "o-sol", "Sol Ring", "cmm", "410"), solB: mk("sol-ltc", "o-sol", "Sol Ring", "ltc", "284"), bolt: mk("bolt", "o-bolt", "Lightning Bolt", "clu", "141", "Instant"), path: mk("path", "o-path", "Path to Exile", "tsr", "299", "Instant"), cs: mk("cs", "o-cs", "Counterspell", "cmr", "395", "Instant") };
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route(u => /^https:/.test(u.href) && u.hostname !== "cards.scryfall.io", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8897/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(C => {
    addToColl(slim(C.solA), "nonfoil", 2, "main", true); addToColl(slim(C.solB), "foil", 1, "main", true); addToColl(slim(C.bolt), "nonfoil", 4, "main", true); addToColl(slim(C.path), "nonfoil", 1, "main", true);
    const deck = (id, name, format, t) => (S.decks[id] = { id, name, format, cmdr: [], cards: {}, created: 1, updated: t });
    const a = deck("a", "Atraxa", "commander", 3), z = deck("z", "Zur <b>Control</b>", "commander", 2), m = deck("m", "Modern Burn", "modern", 1); deck("e", "Empty deck", "casual", 0);
    addToDeck(a, C.solA, 1, false, true);                                             // Sol Ring: one printing, one copy
    addToDeck(z, C.solB, 1, false, true); addToDeck(z, C.solA, 1, true, true);         // Sol Ring: two printings in one deck, one of them in the sideboard
    addToDeck(m, C.bolt, 4, false, true);                                             // four copies in one deck
    save(); go("coll");
  }, C);
  await p.waitForTimeout(400);
  const snap = () => p.evaluate(() => JSON.stringify([S.coll, S.decks]));
  const openOwned = id => p.evaluate(id => { const e = Object.values(S.coll).find(e => e.id === id); openCard(e, e.finish, e.binder); }, id);
  const used = () => p.evaluate(() => { const u = document.querySelector("#usedIn"); if (!u) return null; return { label: u.querySelector(".label").textContent, chips: [...u.querySelectorAll("[data-deck]")].map(b => b.textContent.replace(/\s+/g, " ").trim()), ids: [...u.querySelectorAll("[data-deck]")].map(b => b.dataset.deck), text: u.textContent.replace(/\s+/g, " ").trim() }; });
  const close = async () => { await p.click("#sheetClose"); await p.waitForTimeout(200); };
  const before = await snap();

  await openOwned("path"); await p.waitForSelector("#cPlus"); let u = await used();
  ok(u && u.label === "Used in decks" && u.chips.length === 0 && /Not currently used in any decks\./.test(u.text), `${label}: a card in no deck says so (${u && u.text})`);
  await close();

  await openOwned("bolt"); await p.waitForSelector("#cPlus"); u = await used();
  ok(u.chips.length === 1 && u.chips[0] === "Modern Burn ×4 ›" && /1 deck\b/.test(u.text), `${label}: a card in one deck shows that deck, with all four copies counted (${JSON.stringify(u.chips)})`);
  await close();

  await openOwned("sol-cmm"); await p.waitForSelector("#cPlus"); u = await used(); const viaA = JSON.stringify(u.chips);
  ok(u.chips.length === 2 && u.ids.join(",") === [...new Set(u.ids)].join(",") && /2 decks/.test(u.text), `${label}: a card in several decks lists each deck once (${viaA})`);
  ok(u.chips.includes("Atraxa ×1 ›") && u.chips.some(c => /^Zur <b>Control<\/b> ×2 \(1 in sideboard\) ›$/.test(c)), `${label}: two printings in one deck count together as that deck's copies, the sideboard one noted; a deck name is shown as text (${viaA})`);
  await close();
  await openOwned("sol-ltc"); await p.waitForSelector("#cPlus"); u = await used();
  ok(JSON.stringify(u.chips) === viaA, `${label}: opened from the other printing you own, the same decks are listed (matching is by card name, as elsewhere in the app)`);
  ok(await snap() === before, `${label}: looking at cards changes nothing in the collection or the decks`);
  // tapping a deck goes to it
  await p.click('#usedIn [data-deck="a"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => tab === "decks" && deckOpen === "a" && !document.querySelector("#sheetRoot").innerHTML), `${label}: tapping a deck in the list opens that deck`);

  // added to a deck while the details are open
  await p.evaluate(() => go("coll")); await openOwned("path"); await p.waitForSelector("#dSel");
  await p.selectOption("#dSel", "e"); await p.click("#dMain"); await p.waitForTimeout(250); u = await used();
  ok(u.chips.length === 1 && u.chips[0] === "Empty deck ×1 ›" && await p.$eval("#dSel", e => e.value) === "e", `${label}: added to a deck from the open details: the list shows it at once, and the deck picked stays picked (${JSON.stringify(u.chips)})`);
  await p.click("#dMain"); await p.waitForTimeout(200); await p.click("#dSide"); await p.waitForTimeout(250); u = await used();
  ok(u.chips.length === 1 && u.chips[0] === "Empty deck ×3 (1 in sideboard) ›", `${label}: more copies in the same deck raise its count, they don't add a second line (${JSON.stringify(u.chips)})`);
  await p.selectOption("#dSel", "m"); await p.click("#dSide"); await p.waitForTimeout(250); u = await used();
  ok(u.chips.length === 2 && u.chips.includes("Modern Burn ×1 (sideboard) ›"), `${label}: added to a second deck: both are listed (${JSON.stringify(u.chips)})`);
  ok(await p.evaluate(() => JSON.stringify(Object.keys(Object.values(S.decks.e.cards)[0]).sort()) === JSON.stringify(Object.keys(Object.values(S.decks.m.cards).find(c => c.name === "Lightning Bolt")).sort())), `${label}: a card added this way is stored exactly like any other deck card (no new fields)`);
  await close();

  // removed from a deck (the card opened from the deck, then "Remove from deck")
  await p.evaluate(() => go("decks", "e")); await p.waitForTimeout(300);
  await p.click('#dl [data-open]'); await p.waitForSelector("#cDeckDel"); u = await used(); const had = u.chips.length;
  await p.click("#cDeckDec"); await p.waitForTimeout(200); u = await used(); const less = JSON.stringify(u.chips);
  await p.click("#cDeckDel"); await p.waitForTimeout(250); u = await used();
  ok(had === 2 && /Empty deck ×2 \(1 in sideboard\)/.test(less) && u.chips.length === 2 && u.chips.some(c => /^Empty deck ×1 \(sideboard\) ›$/.test(c)), `${label}: one copy less, then the main-deck copies removed: the count follows each step (${less} → ${JSON.stringify(u.chips)})`);
  await close();
  await p.evaluate(() => { const d = S.decks.e; for (const k of Object.keys(d.cards)) delete d.cards[k]; save(); go("coll"); }); await openOwned("path"); await p.waitForSelector("#cPlus"); u = await used();
  ok(u.chips.length === 1 && u.chips[0] === "Modern Burn ×1 (sideboard) ›", `${label}: once a deck no longer holds the card it is gone from the list (${JSON.stringify(u.chips)})`);
  await close();

  // a card you don't own and that is in no deck (opened from Search): no section; one you don't own but a deck uses: listed
  await p.evaluate(c => { go("search"); openCard(c); }, C.cs); await p.waitForSelector("#cPlus");
  ok(await used() === null, `${label}: a card you neither own nor use in a deck gets no "Used in decks" line`);
  await close();
  await p.evaluate(c => { addToDeck(S.decks.a, c, 1, false); openCard(c); }, C.cs); await p.waitForSelector("#cPlus"); u = await used();
  ok(u && u.chips.join() === "Atraxa ×1 ›", `${label}: a card you don't own but a deck uses is listed too (${u && JSON.stringify(u.chips)})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll("#usedIn .chip")].every(c => c.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: the list fits the screen`);
  await close();
  // the rest of the app still works: the collection total and a deck's count are what they should be
  ok(await p.evaluate(() => Object.values(S.coll).reduce((a, e) => a + e.qty, 0) === 8 && deckStats(S.decks.z).mainN === 1 && deckStats(S.decks.m).mainN === 4), `${label}: collection and deck counts are untouched by all of this`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8897", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
