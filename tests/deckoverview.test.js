// Decks list: the overview under each deck (who leads it, what it is made of, how much of it you own, what is missing).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process"); const path = require("path");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const mk = (id, name, type, colors, set = "tst", num = "1") => ({ object: "card", id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: type, cmc: 2, mana_cost: "{2}", colors, color_identity: colors,
  prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal", modern: "legal" }, image_uris: { small: `https://cards.scryfall.io/${id}.png`, normal: `https://cards.scryfall.io/${id}.png` } });
const C = { atraxa: mk("atraxa", "Atraxa, Praetors' Voice", "Legendary Creature — Phyrexian Angel", ["W", "U", "B", "G"]), solA: mk("sol-cmm", "Sol Ring", "Artifact", [], "cmm", "410"), solB: mk("sol-ltc", "Sol Ring", "Artifact", [], "ltc", "284"),
  bolt: mk("bolt", "Lightning Bolt", "Instant", ["R"]), forest: mk("forest", "Forest", "Basic Land — Forest", []), cs: mk("cs", "Counterspell", "Instant", ["U"]), path: mk("path", "Path to Exile", "Instant", ["W"]) };
async function run(opts, label, shot) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route(u => /^https:/.test(u.href) && u.hostname !== "cards.scryfall.io", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8899/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(C => {
    S.binders.wish = { id: "wish", name: "Wishlist", wish: true };
    addToColl(slim(C.solA), "nonfoil", 1, "main", true); addToColl(slim(C.solB), "nonfoil", 1, "main", true); addToColl(slim(C.bolt), "nonfoil", 3, "main", true); addToColl(slim(C.forest), "nonfoil", 10, "main", true); addToColl(slim(C.atraxa), "nonfoil", 1, "main", true);
    addToColl(slim(C.cs), "nonfoil", 2, "wish", true);                                  // on the wishlist: not owned
    const deck = (id, name, format, t) => (S.decks[id] = { id, name, format, cmdr: [], cards: {}, created: 1, updated: t });
    const cmd = deck("cmd", "Atraxa Superfriends", "commander", 9); addToDeck(cmd, C.atraxa, 1, false, true); cmd.cmdr = ["atraxa|0"]; addToDeck(cmd, C.solA, 1, false, true); addToDeck(cmd, C.forest, 10, false, true); addToDeck(cmd, C.cs, 1, false, true);
    const burn = deck("burn", "Modern Burn", "modern", 8); addToDeck(burn, C.bolt, 4, false, true); addToDeck(burn, C.solA, 2, false, true); addToDeck(burn, C.solB, 1, true, true); addToDeck(burn, C.path, 2, false, true);
    const full = deck("full", "All owned", "casual", 7); addToDeck(full, C.forest, 5, false, true); addToDeck(full, C.bolt, 1, false, true);
    const none = deck("none", "Nothing owned", "casual", 6); addToDeck(none, C.path, 1, false, true); addToDeck(none, C.cs, 2, false, true);
    const art = deck("art", "Artifacts", "casual", 5); addToDeck(art, C.solB, 1, false, true);
    deck("empty", "Empty commander", "commander", 4);
    save(); go("decks");
  }, C);
  await p.waitForTimeout(500);
  const snap = () => p.evaluate(() => JSON.stringify([S.coll, S.decks, S.binders, S.settings || null]));
  const before = await snap();
  const line = id => p.$eval(`details[data-ov="${id}"] > summary`, e => [...e.children].map(x => x.textContent.trim()).join(" "));
  const open = async id => { await p.click(`details[data-ov="${id}"] > summary`); await p.waitForTimeout(150); };
  const body = id => p.$eval(`details[data-ov="${id}"] .ov-body`, e => e.innerText.replace(/[ \t]+/g, " ").replace(/\n+/g, " | ").trim());
  const pipsOf = id => p.$$eval(`details[data-ov="${id}"] .ov-body .pip`, a => a.map(x => x.textContent).join(""));
  const missRows = id => p.$$eval(`details[data-ov="${id}"] .ov-tbl tbody tr`, a => a.map(tr => [...tr.children].map(td => td.textContent.trim()).join(" / ")));

  // closed by default: one short line per deck, the list itself unchanged
  ok(await p.$$eval(".deck-card", a => a.length) === 6 && await p.$$eval("details[data-ov][open]", a => a.length) === 0 && await p.$$eval(".ov-body", a => a.every(x => !x.innerHTML)), `${label}: every deck gets an overview line, closed to begin with`);
  ok(await line("cmd") === "Overview 12 of 13 owned · 92%" && await line("burn") === "Overview 5 of 9 owned · 55%" && await line("full") === "Overview 6 of 6 owned · 100%" && await line("none") === "Overview 0 of 3 owned · 0%" && await line("empty") === "Overview no cards yet",
    `${label}: the line says how much of each deck you own (${[await line("cmd"), await line("burn"), await line("full"), await line("none"), await line("empty")].join(" ; ")})`);
  if (shot) await p.screenshot({ path: shot + "_closed.png" });

  // a Commander deck with a commander
  await open("cmd"); let t = await body("cmd");
  ok(/Format \| Commander/.test(t) && /Commander \| Atraxa, Praetors' Voice/.test(t) && await pipsOf("cmd") === "WUBG", `${label}: a Commander deck: format, its commander and the commander's color identity (${await pipsOf("cmd")})`);
  ok(/Cards \| 13 \| Main deck \| 13\/100 \| Different cards \| 4/i.test(t) && !/Sideboard/i.test(t), `${label}: its sizes: 13 cards, 13 of 100 in the main deck, 4 different cards, no sideboard shown (${t.slice(0, 160)})`);
  ok(/92%/.test(t) && /13 needed · 12 owned · 1 missing/.test(t), `${label}: 13 needed, 12 owned, 1 missing, 92%`);
  ok(JSON.stringify(await missRows("cmd")) === JSON.stringify(["Counterspell / 1 / 0 (none) / 1"]), `${label}: the missing card is the one that is only on the wishlist, shown as owning none (${JSON.stringify(await missRows("cmd"))})`);
  ok(await p.$eval('details[data-ov="cmd"] .ov-miss', e => !e.open), `${label}: the list of missing cards stays folded until asked for`);

  // no commander, several colors, main and sideboard, several copies, two printings
  await open("burn"); t = await body("burn");
  ok(/Format \| Modern/.test(t) && !/Commander/.test(t) && await pipsOf("burn") === "WR", `${label}: a deck without a commander shows no commander line, and its cards' colors (${await pipsOf("burn")})`);
  ok(/Cards \| 9 \| Main deck \| 8\/60 \| Sideboard \| 1 \| Different cards \| 3/i.test(t), `${label}: main deck 8, sideboard 1, 9 in all, 3 different cards (two printings of one card count as one card)`);
  ok(/9 needed · 5 owned · 4 missing/.test(t) && /55%/.test(t), `${label}: partly owned: 9 needed, 5 owned, 4 missing, 55%`);
  await p.click('details[data-ov="burn"] .ov-miss > summary'); await p.waitForTimeout(100);
  ok(JSON.stringify(await missRows("burn")) === JSON.stringify(["Path to Exile / 2 / 0 (none) / 2", "Lightning Bolt / 4 / 3 / 1", "Sol Ring / 3 / 2 / 1"]), `${label}: missing cards with needed, owned and missing; 3 owned Bolts don't cover 4; both Sol Ring printings count toward the 3 needed (${JSON.stringify(await missRows("burn"))})`);
  ok(/3 cards still needed \(4 copies\)/.test(t), `${label}: the fold says how many cards and copies are still needed`);

  await open("full"); t = await body("full");
  ok(/100%/.test(t) && /6 needed · 6 owned · 0 missing/.test(t) && /You own every card in this deck\./.test(t) && !(await p.$('details[data-ov="full"] .ov-miss')), `${label}: every card owned: 100%, and no missing list`);
  await open("none"); t = await body("none");
  ok(/0%/.test(t) && /3 needed · 0 owned · 3 missing/.test(t) && (await missRows("none")).every(r => /0 \(none\)/.test(r)) && (await missRows("none")).length === 2, `${label}: nothing owned: 0%, every card listed as owning none`);
  await open("art"); t = await body("art");
  ok(/Colors \| C Colorless/.test(t) && await pipsOf("art") === "C", `${label}: a deck with no colors says colorless`);
  await open("empty"); t = await body("empty");
  ok(/Commander \| Not chosen yet/.test(t) && /No cards in this deck yet\./.test(t) && !/%/.test(t), `${label}: an empty Commander deck: no commander yet, no percentage made up`);
  ok(await p.evaluate(() => Object.values(S.decks).every(d => deckOwnership(d).missing === deckStats(d).missing && deckOwnership(d).required === deckStats(d).mainN + deckStats(d).sideN)), `${label}: the overview's numbers are the same ones the rest of the app uses (not owned count, deck size)`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1 && [...document.querySelectorAll(".deck-ov, .ov-tbl, .ov-sum")].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)), `${label}: with every overview open nothing runs off the side of the screen`);
  if (shot) { await p.evaluate(() => document.querySelector('details[data-ov="burn"]').scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -110)); await p.screenshot({ path: shot + "_open.png" }); }
  ok(await snap() === before, `${label}: opening every overview changes nothing in the collection, decks, binders or settings`);
  ok(await p.evaluate(() => tab === "decks" && !deckOpen), `${label}: opening an overview doesn't open the deck`);

  // copies not shared between decks: copies other decks use aren't available
  await p.evaluate(() => { S.settings = S.settings || {}; S.settings.shareCopies = false; save(); go("decks"); }); await p.waitForTimeout(300);
  ok(await p.$$eval("details[data-ov][open]", a => a.length) === 6, `${label}: overviews that were open stay open when the list is redrawn`);
  t = await body("art");
  ok(await line("art") === "Overview 0 of 1 owned · 0%" && JSON.stringify(await missRows("art")) === JSON.stringify(["Sol Ring / 1 / 2 (0 free) / 1"]) && /other decks aren't counted/.test(t), `${label}: with sharing copies off, the 2 Sol Rings other decks use aren't counted for this deck (${await line("art")}; ${JSON.stringify(await missRows("art"))})`);
  ok(await p.evaluate(() => Object.values(S.decks).every(d => deckOwnership(d).missing === deckStats(d).missing)), `${label}: …and still the same count as the deck's own "not owned or free"`);
  await p.evaluate(() => { S.settings.shareCopies = true; save(); go("decks"); }); await p.waitForTimeout(300);

  // the deck still opens and edits as before, and the overview follows
  await p.click('.deck-card[data-d="burn"]'); await p.waitForSelector("#back");
  ok(await p.evaluate(() => deckOpen === "burn"), `${label}: tapping a deck still opens it`);
  await p.click('[data-inc="bolt|0"]'); await p.waitForTimeout(200); await p.click("#back"); await p.waitForTimeout(300);
  ok(await line("burn") === "Overview 5 of 10 owned · 50%" && (await missRows("burn")).includes("Lightning Bolt / 5 / 3 / 2"), `${label}: after adding a copy in the deck editor the overview is up to date (${await line("burn")})`);
  await p.click('details[data-ov="burn"] > summary'); await p.waitForTimeout(150); await p.evaluate(() => go("coll")); await p.evaluate(() => go("decks")); await p.waitForTimeout(250);
  ok(await p.$eval('details[data-ov="burn"]', e => !e.open) && await p.$eval('details[data-ov="cmd"]', e => e.open), `${label}: a closed overview stays closed, an open one open`);
  // the collection changes: the overview follows
  await p.evaluate(C => { addToColl(slim(C.path), "nonfoil", 2, "main"); go("decks"); }, C); await p.waitForTimeout(250);
  ok(await line("burn") === "Overview 7 of 10 owned · 70%" && await line("none") === "Overview 1 of 3 owned · 33%", `${label}: adding cards to the collection raises what is owned (${await line("burn")}; ${await line("none")})`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8899", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer", process.env.SHOTS && "/tmp/ov_pc"); await run({ ...devices["Pixel 7"] }, "phone", process.env.SHOTS && "/tmp/ov_phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
