// Suggestions (All cards): a two-faced card added with ＋ leaves the list and stays out of it. EDHREC names a modal,
// adventure or split card by its front face ("Disciple of Freyalise"); the deck keeps Scryfall's full name ("Disciple of
// Freyalise // Garden of Freyalise"), so the list, reloaded after the add, used to show it again as if it weren't added.
// Real data: the cards are Scryfall's records (Oracle Cards bulk data, Nov 16, 2026); the figures are EDHREC's for Yeva,
// Nature's Herald (Nov 24, 2026), where Disciple of Freyalise is listed under its front name in both Creatures and Lands.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const CARDS = [{"object":"card","id":"67ff9ba3-cd2b-4970-b4da-22104b10a4a4","oracle_id":"2d513c3e-bd27-479e-af32-7f66d96d0de0","name":"Yeva, Nature's Herald","set":"rvr","set_name":"Ravnica Remastered","collector_number":"162","rarity":"rare","type_line":"Legendary Creature — Elf Shaman","cmc":4.0,"mana_cost":"{2}{G}{G}","colors":["G"],"color_identity":["G"],"oracle_text":"Flash (You may cast this spell any time you could cast an instant.)\nYou may cast green creature spells as though they had flash.","layout":"normal","keywords":["Flash"],"prices":{"usd":"1.32","usd_foil":"1.03","usd_etched":null},"finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
  {"object":"card","id":"a8e9ea5a-5e10-4b77-baef-0352ff035483","oracle_id":"2699005b-a471-429f-a9d8-fbf2077ee2fd","name":"Disciple of Freyalise // Garden of Freyalise","set":"mh3","set_name":"Modern Horizons 3","collector_number":"250","rarity":"uncommon","type_line":"Creature — Elf Druid // Land","cmc":6.0,"color_identity":["G"],"layout":"modal_dfc","keywords":[],"produced_mana":["G"],"prices":{"usd":"1.80","usd_foil":"4.09","usd_etched":null},"finishes":["nonfoil","foil"],"legalities":{"commander":"legal"},
    "card_faces":[{"object":"card_face","name":"Disciple of Freyalise","mana_cost":"{3}{G}{G}{G}","type_line":"Creature — Elf Druid","oracle_text":"When this creature enters, you may sacrifice another creature. If you do, you gain X life and draw X cards, where X is that creature's power.","colors":["G"]},
      {"object":"card_face","name":"Garden of Freyalise","mana_cost":"","type_line":"Land","oracle_text":"As this land enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {G}.","colors":[]}]},
  {"object":"card","id":"6a0b230b-d391-4998-a3f7-7b158a0ec2cd","oracle_id":"68954295-54e3-4303-a6bc-fc4547a4e3a3","name":"Llanowar Elves","set":"fdn","set_name":"Foundations","collector_number":"227","rarity":"common","type_line":"Creature — Elf Druid","cmc":1.0,"mana_cost":"{G}","colors":["G"],"color_identity":["G"],"oracle_text":"{T}: Add {G}.","layout":"normal","keywords":[],"produced_mana":["G"],"prices":{"usd":"0.23","usd_foil":"0.78","usd_etched":null},"finishes":["nonfoil","foil"],"legalities":{"commander":"legal"}},
  {"object":"card","id":"eb654a76-62ee-4fd8-83d4-cb912211a9a0","oracle_id":"3f3b2c10-21f8-4e13-be83-4ef3fa36e123","name":"Elvish Mystic","set":"soc","set_name":"Secrets of Strixhaven Commander","collector_number":"266","rarity":"common","type_line":"Creature — Elf Druid","cmc":1.0,"mana_cost":"{G}","colors":["G"],"color_identity":["G"],"oracle_text":"{T}: Add {G}.","layout":"normal","keywords":[],"produced_mana":["G"],"prices":{"usd":"0.42","usd_foil":null,"usd_etched":null},"finishes":["nonfoil"],"legalities":{"commander":"legal"}},
  {"object":"card","id":"5f533364-0f91-4e49-aaeb-83c4c1f6d316","oracle_id":"b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6","name":"Forest","set":"hob","set_name":"The Hobbit","collector_number":"198","rarity":"common","type_line":"Basic Land — Forest","cmc":0.0,"mana_cost":"","colors":[],"color_identity":["G"],"oracle_text":"({T}: Add {G}.)","layout":"normal","keywords":[],"produced_mana":["G"],"prices":{"usd":null,"usd_foil":null,"usd_etched":null},"finishes":["nonfoil"],"legalities":{"commander":"legal"}}];
const BY = {}; for (const c of CARDS) { BY[c.name] = c; BY[c.name.split(" // ")[0]] = c; }
const cv = (name, num_decks, synergy) => ({ name, sanitized: name.toLowerCase(), num_decks, potential_decks: 1995, synergy });
const EDH = { "commanders/yeva-natures-herald": { panels: { taglinks: [] }, container: { json_dict: { cardlists: [
  { header: "Top Cards", tag: "topcards", cardviews: [cv("Llanowar Elves", 1636, 0.27660532843603247), cv("Elvish Mystic", 1524, 0.3029822704606293)] },
  { header: "Creatures", tag: "creatures", cardviews: [cv("Disciple of Freyalise", 962, 0.2968431183962782)] },
  { header: "Lands", tag: "lands", cardviews: [cv("Disciple of Freyalise", 962, 0.2968431183962782)] }] } } } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8945", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 420, height: 900 } }), errs = [];
    p.on("pageerror", e => errs.push(e.message));
    const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, J = (r, j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: H, body: JSON.stringify(j) });
    await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await p.route("https://json.edhrec.com/**", r => { const path = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, ""); return EDH[path] ? J(r, EDH[path]) : J(r, {}, 404); });
    await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url());
      if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
      if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J(r, { data: ids.map(i => BY[i.name]).filter(Boolean), not_found: [] }); }
      if (u.includes("/cards/search")) return J(r, { object: "list", has_more: false, data: [] });
      return J(r, {}, 404); });
    await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: H, body: "{}" }));
    await p.goto("http://127.0.0.1:8945/app_real.html"); await p.waitForTimeout(600);
    await p.evaluate(CARDS => { window.__C = Object.fromEntries(CARDS.map(c => [c.name, c]));
      window.__deck = (id, extra = []) => { const d = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
        for (const [n, q] of [["Yeva, Nature's Herald", 1], ["Forest", 30], ...extra]) addToDeck(d, slim(__C[n]), q, false, true);
        d.cmdr = [slim(__C["Yeva, Nature's Herald"]).id + "|0"]; S.decks[id] = d; save(); return d; }; }, CARDS);
    const names = () => p.$$eval("#rList .item .name", e => e.map(x => x.textContent));
    const inDeck = (id, n) => p.evaluate(([id, n]) => Object.values(S.decks[id].cards).filter(c => c.name === n).reduce((a, c) => a + c.qty, 0), [id, n]);
    const plus = n => p.evaluate(n => { const it = [...document.querySelectorAll("#rList .item")].find(x => x.querySelector(".name").textContent === n); it.querySelector("[data-radd]").click(); }, n);
    const DFC = "Disciple of Freyalise // Garden of Freyalise";

    // 1. Yeva's Suggestions, All cards · Commander: the two-faced card is offered
    await p.evaluate(() => { __deck("yeva"); deckTab.yeva = "suggest"; go("decks", "yeva"); });
    await p.waitForFunction(() => document.querySelectorAll("#rList .item").length >= 3, null, { timeout: 15000 });
    let L = await names();
    ok(L.includes(DFC) && L.includes("Llanowar Elves") && L.includes("Elvish Mystic"), `Yeva's suggestions from EDHREC include Disciple of Freyalise (listed there by its front name): ${L.join(", ")}`);
    ok(await p.evaluate(() => recState.yeva.which === "commander" && recState.yeva.pool === "all"), "the list is All cards · Commander");

    // 2. ＋ adds it once; the list reloads (the deck changed) and doesn't show it again
    await plus(DFC); await p.waitForTimeout(1500);
    L = await names();
    ok(await inDeck("yeva", DFC) === 1, `＋ added one Disciple of Freyalise to the deck, under Scryfall's full name`);
    ok(!L.includes(DFC), `after the list reloads, Disciple of Freyalise isn't suggested again: ${L.join(", ")}`);
    ok(L.includes("Llanowar Elves") && L.includes("Elvish Mystic"), "cards not in the deck are still suggested (nothing else is hidden by the front-name match)");
    // the same list loaded again from scratch
    await p.evaluate(() => { recState.yeva.data = null; drawSuggest(S.decks.yeva); }); await p.waitForTimeout(1500);
    L = await names();
    ok(!L.includes(DFC) && L.includes("Llanowar Elves"), `loaded again from scratch, it still isn't suggested: ${L.join(", ")}`);
    ok(await inDeck("yeva", DFC) === 1, "the deck still has exactly one copy");

    // 3. a one-faced card behaves as before
    await plus("Llanowar Elves"); await p.waitForTimeout(1500);
    L = await names();
    ok(await inDeck("yeva", "Llanowar Elves") === 1 && !L.includes("Llanowar Elves") && L.includes("Elvish Mystic"), `＋ on Llanowar Elves: added once and gone from the list: ${L.join(", ")}`);

    // 4. a deck that already has the two-faced card doesn't get it suggested on the first load either
    await p.evaluate(DFC => { __deck("yeva2", [[DFC, 1]]); deckTab.yeva2 = "suggest"; go("decks", "yeva2"); }, DFC);
    await p.waitForFunction(() => document.querySelectorAll("#rList .item").length >= 2, null, { timeout: 15000 }); await p.waitForTimeout(300);
    L = await names();
    ok(!L.includes(DFC) && L.includes("Llanowar Elves") && L.includes("Elvish Mystic"), `a deck that already plays Disciple of Freyalise: not suggested (${L.join(", ")})`);
    ok(!errs.length, "no errors" + (errs.length ? ": " + errs[0] : ""));
  } finally { await b.close(); srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
