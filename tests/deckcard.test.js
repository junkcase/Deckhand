// A card opened from a deck: the add controls stay under "In your collection"; the printing you choose, add, or tap
// among your copies becomes the one the deck uses; your copies can be tapped and changed with − / +.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const pr = (id, set, num) => ({ object: "card", id, oracle_id: "o-sol", name: "Sol Ring", set, set_name: set.toUpperCase() + " Set", collector_number: num, rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [],
  prices: { usd: "1.50", usd_foil: "4" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/${id}.png`, normal: `https://cards.scryfall.io/${id}.png` } });
const PRINTS = [pr("sol-cmm", "cmm", "410"), pr("sol-c21", "c21", "263"), pr("sol-ltc", "ltc", "284")];
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8824", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*" };
    if (u.includes("/cards/search")) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ object: "list", has_more: false, data: PRINTS }) });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8824/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(P => { S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade binder" } };
    addToColl(slim(P[1]), "foil", 1, "main", true, { cond: "LP", paid: 3 }); addToColl(slim(P[2]), "nonfoil", 2, "trade", true);
    const d = { id: "d", name: "Atraxa", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.d = d; addToDeck(d, P[0], 1, false, true); save(); go("decks", "d"); }, PRINTS);
  await p.waitForTimeout(300);
  const deckPr = () => p.evaluate(() => Object.values(S.decks.d.cards).map(c => c.set + "#" + c.num + "×" + c.qty).join(","));
  const own = () => p.evaluate(() => Object.values(S.coll).filter(e => e.name === "Sol Ring").map(e => `${e.set}#${e.num}/${e.finish}/${e.binder}×${e.qty}`).sort().join(","));
  const R = {};
  await p.click('#dl [data-open]'); await p.waitForSelector("#cPlus");
  R.inBox = await p.evaluate(() => [!document.querySelector("#cBar"), !!document.querySelector("#cAddRow").closest(".box")]);
  R.copies = await p.$$eval(".own[data-ok]", a => a.length);
  // tap the trade-binder copy: it becomes the printing shown, and the deck uses its art
  await p.click('.own[data-ok*="sol-ltc"] > .kv > .grow'); await p.waitForTimeout(250);
  R.tapCopy = [await deckPr(), await p.$eval(".addpr", e => e.textContent.replace(/\s+/g, " ").trim()), await p.$eval("#bSel", e => e.value), await p.$eval(".own.picked", e => e.dataset.ok)];
  // − / + on a copy you own
  await p.click('[data-oinc*="sol-c21"]'); await p.waitForTimeout(150); R.inc = await own();
  await p.click('[data-odec*="sol-ltc"]'); await p.waitForTimeout(150); R.dec = await own();
  await p.click('[data-odec*="sol-ltc"]'); await p.waitForTimeout(200); R.gone = [await own(), await p.$eval("#toastRoot", e => e.textContent)];
  await p.click("#toastRoot button"); await p.waitForTimeout(150); R.undo = await own();
  // choose a printing: the deck uses it
  await p.click("#cPickPr"); await p.waitForSelector("#cPickBox [data-i]"); await p.click('#cPickBox [data-i="1"]'); await p.waitForTimeout(250); R.choose = await deckPr(); R.pref = await p.evaluate(() => (S.settings["pp:sol ring"] || {}).id);
  // add a different printing to the collection: the deck uses it too
  await p.click("#cPickPr"); await p.waitForSelector("#cPickBox [data-i]"); await p.click('#cPickBox [data-i="0"]'); await p.waitForTimeout(200);
  await p.click("#cPlus"); await p.waitForTimeout(200); R.add = [await deckPr(), await own()];
  await p.click("#sheetClose"); await p.waitForTimeout(250); R.deckArt = await p.$eval("#dl [data-open]", e => e.dataset.open);
  // with several copies in the deck, choosing a printing doesn't switch them all
  await p.evaluate(() => { const c = Object.values(S.decks.d.cards)[0]; c.qty = 3; go("decks", "d"); }); await p.waitForTimeout(200);
  await p.click('#dl [data-open]'); await p.waitForSelector("#cPickPr"); await p.click("#cPickPr"); await p.waitForSelector("#cPickBox [data-i]"); await p.click('#cPickBox [data-i="2"]'); await p.waitForTimeout(250);
  R.multi = [await deckPr(), !!(await p.$("#cDeckAddPr"))]; await p.click("#sheetClose"); await p.waitForTimeout(150);
  // opened outside a deck, the add bar is still at the bottom
  await p.evaluate(() => { go("coll"); const e = Object.values(S.coll)[0]; openCard(e, e.finish, e.binder); }); await p.waitForTimeout(300); R.collBar = !!(await p.$("#cBar #cPlus"));
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts), J = JSON.stringify;
    ok(J(R.inBox) === "[true,true]", `${label}: from a deck, the add controls stay under "In your collection" ${J(R.inBox)}`);
    ok(R.copies === 2, `${label}: both copies you own are listed (${R.copies})`);
    ok(R.tapCopy[0] === "ltc#284×1" && /LTC #284/.test(R.tapCopy[1]) && R.tapCopy[2] === "trade" && /sol-ltc/.test(R.tapCopy[3]), `${label}: tapping a copy shows that printing and the deck uses its art ${J(R.tapCopy)}`);
    ok(R.inc === "c21#263/foil/main×2,ltc#284/nonfoil/trade×2" && R.dec === "c21#263/foil/main×2,ltc#284/nonfoil/trade×1", `${label}: + / − on a copy change exactly that copy ${J([R.inc, R.dec])}`);
    ok(R.gone[0] === "c21#263/foil/main×2" && /Removed 1 Sol Ring/.test(R.gone[1]) && R.undo === R.dec, `${label}: removing the last one can be undone ${J([R.gone, R.undo])}`);
    ok(R.pref === "sol-c21", `${label}: and it's remembered as the printing to use next time (${R.pref})`);
    ok(R.choose === "c21#263×1", `${label}: choosing a printing makes the deck use it (${R.choose})`);
    ok(R.add[0] === "cmm#410×1" && /cmm#410\/(nonfoil|foil)\/trade×1/.test(R.add[1]), `${label}: adding a printing to the collection makes the deck use it ${J(R.add)}`);
    ok(R.deckArt === "sol-cmm|0", `${label}: back in the deck list, the card shows that printing (${R.deckArt})`);
    ok(R.multi[0] === "cmm#410×3" && R.multi[1], `${label}: with 3 copies in the deck, choosing a printing leaves them and offers to add it alongside ${JSON.stringify(R.multi)}`);
    ok(R.collBar, `${label}: opened outside a deck, the add bar is still at the bottom`);
    ok(!R.errs.length, `${label}: no errors ${J(R.errs)}`);
  }
})();
