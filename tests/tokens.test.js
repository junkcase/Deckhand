// Token collector: a set's tokens (its own and its Commander decks') on the set page, a Tokens binder, token counts in
// the Sets list, tokens in value, quick add and imports to the Tokens binder, and "Tokens this deck makes".
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (id, name, set, num, type, extra = {}) => Object.assign({ object: "card", id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "common", type_line: type, cmc: 0, mana_cost: "", colors: [], color_identity: [],
  prices: { usd: "0.50" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/${id}.png`, normal: `https://cards.scryfall.io/${id}.png` } }, extra);
const TOK = [C("t-rabbit", "Rabbit", "tblb", "1", "Token Creature — Rabbit"), C("t-otter", "Otter", "tblb", "2", "Token Creature — Otter"), C("t-food", "Food", "tblb", "3", "Token Artifact — Food")];
const TOKC = [C("t-squirrel", "Squirrel", "tblc", "1", "Token Creature — Squirrel")];
const GOBLIN = C("t-goblin", "Goblin", "tm10", "5", "Token Creature — Goblin"), GOBLIN2 = C("t-goblin-old", "Goblin", "tdom", "9", "Token Creature — Goblin", { oracle_id: "o-Goblin" });
const TREASURE = C("t-treasure", "Treasure", "tsnc", "14", "Token Artifact — Treasure");
const KRENKO = C("krenko", "Krenko, Mob Boss", "m13", "139", "Legendary Creature — Goblin Warrior", { all_parts: [{ component: "combo_piece", id: "krenko" }, { component: "token", id: "t-goblin" }] });
const TITHE = C("tithe", "Smothering Tithe", "rna", "22", "Enchantment", { all_parts: [{ component: "token", id: "t-treasure" }] });
const SOL = C("sol", "Sol Ring", "cmm", "410", "Artifact");
const ALL = [...TOK, ...TOKC, GOBLIN, GOBLIN2, TREASURE, KRENKO, TITHE, SOL];
const SETLIST = [["blb", "Bloomburrow", "expansion", ""], ["tblb", "Bloomburrow Tokens", "token", "blb"], ["blc", "Bloomburrow Commander", "commander", "blb"], ["tblc", "Bloomburrow Commander Tokens", "token", "blc"], ["m13", "Magic 2013", "core", ""]]
  .map(([code, name, set_type, parent]) => ({ code, name, set_type, parent_set_code: parent || undefined, released_at: "2024-08-02", card_count: code === "tblb" ? 3 : code === "tblc" ? 1 : 280, printed_size: 261, icon_svg_uri: `https://svgs.scryfall.io/sets/${code}.svg` }));
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8826", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://svgs.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='5'/></svg>" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, J = j => r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify(j) });
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (/\/sets(\?|$)/.test(u)) return J({ data: SETLIST });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J({ data: ids.map(x => ALL.find(c => c.id === x.id || (x.name && c.name.toLowerCase() === x.name.toLowerCase()))).filter(Boolean), not_found: [] }); }
    const m = u.match(/e:(\w+)/); if (u.includes("/cards/search") && m) return J({ object: "list", has_more: false, data: ALL.filter(c => c.set === m[1]) });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8826/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(A => { S.binders = { main: { id: "main", name: "Collection" } }; S.meta.binder = "main"; addToColl(slim(A.find(c => c.id === "sol")), "nonfoil", 1, "main"); save(); return loadSets(); }, ALL);
  const R = {};
  // set page → Tokens
  await p.evaluate(() => { sv.mode = "sets"; sv.setCode = "blb"; sv.setState = null; go("search"); }); await p.waitForSelector('#sdTab [data-t="tok"]');
  R.tab = await p.$eval('#sdTab [data-t="tok"]', e => e.textContent);
  await p.click('#sdTab [data-t="tok"]'); await p.waitForSelector("#sdTok .bcard");
  R.grid = await p.$$eval("#sdTok .bcard", a => a.map(x => x.title));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click('#sdTok [data-tk="t-otter"]'); await p.waitForSelector("#cPlus");
  R.bin = [await p.$eval("#bSel", e => e.value), await p.evaluate(() => S.binders.tokens && S.binders.tokens.name), await p.$eval("#cnPos", e => e.textContent).catch(() => "")];
  await p.selectOption("#bSel", "main"); await p.selectOption("#bSel", "tokens"); R.defaultKept = await p.evaluate(() => S.meta.binder);
  await p.click("#cPlus"); await p.waitForTimeout(200); await p.click("#sheetClose"); await p.waitForTimeout(300);
  R.after = [await p.$eval('#sdTab [data-t="tok"]', e => e.textContent), await p.$eval("#tokCount", e => e.textContent), await p.$eval('#sdTok [data-tk="t-otter"]', e => e.className), await p.evaluate(() => Object.values(S.coll).filter(e => e.binder === "tokens").map(e => e.name).join())];
  // Sets list: tokens under the main set, not a row of their own
  await p.evaluate(() => { sv.setCode = null; renderSearch(); }); await p.waitForSelector("#setsBody .setrow");
  R.rows = await p.$$eval("#setsBody .setrow", a => a.map(x => x.dataset.set + ":" + ((x.querySelector(".settok") || {}).textContent || "")));
  // value includes tokens
  R.value = await p.evaluate(() => Math.round(Object.values(collStats("all").sets).reduce((a, x) => a + x.val, 0) * 100));
  // quick add a token from search results: Tokens binder
  await p.evaluate(A => { sv.mode = "search"; go("search"); sv.results = [A.find(c => c.id === "t-food")]; sv.ran = true; drawResults(); }, ALL); await p.click('#sres [data-qa="0"]'); await p.waitForTimeout(200);
  R.quick = await p.evaluate(() => Object.values(S.coll).filter(e => e.name === "Food").map(e => e.binder).join());
  // collection import with a Tokens section
  await p.evaluate(() => csvImport({ name: "my cards.txt", text: async () => "1 Krenko, Mob Boss\n\nTokens\n2 Treasure" }, { kind: "coll", id: "main" })); await p.waitForSelector("#impGo"); await p.click("#impGo");
  await p.waitForSelector("#impDone, #impRes", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300);
  R.imp = await p.evaluate(() => Object.values(S.coll).filter(e => /Krenko|Treasure/.test(e.name)).map(e => e.name + "→" + e.binder + "×" + e.qty).sort().join(", "));
  await p.evaluate(() => closeSheet());
  // deck: Tokens this deck makes
  await p.evaluate(A => { const d = { id: "d", name: "Goblins", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; S.decks.d = d; for (const id of ["krenko", "tithe", "sol"]) addToDeck(d, A.find(c => c.id === id), 1, false, true);
    for (const [k, e] of Object.entries(S.coll)) if (e.name === "Treasure") delete S.coll[k];      // (so one token is still missing)
    addToColl(slim(A.find(c => c.id === "t-goblin-old")), "nonfoil", 1, "tokens"); S.meta.deckTokOpen = false; save(); go("decks", "d"); }, ALL);
  await p.waitForTimeout(300); await p.click("#dTokens summary"); await p.waitForSelector("#dTokGrid .bcard");
  R.deckTok = await p.$$eval("#dTokGrid .bcard", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim() + (x.classList.contains("own") ? " [own]" : " [missing]")));
  R.deckSum = await p.$eval("#dTokSum", e => e.textContent);
  await p.click('#dTokGrid [data-dt="1"]'); await p.waitForSelector("#cPlus"); R.deckTokBin = await p.$eval("#bSel", e => e.value);
  await p.click("#cPlus"); await p.waitForTimeout(200); R.noFrom = await p.evaluate(() => Object.values(S.coll).every(e => !("from" in e)));
  await p.click("#sheetClose"); await p.waitForTimeout(400); await p.waitForSelector("#dTokGrid .bcard"); R.deckTok2 = await p.$$eval("#dTokGrid .bcard", a => a.map(x => x.classList.contains("own")));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "tokens_phone.png"]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(R.tab === "Tokens 0/4" && R.grid.length === 4 && R.grid.every(t => /missing/.test(t)), `${label}: a set's page has a Tokens view with its own and its Commander decks' tokens ${J([R.tab, R.grid])}`);
    ok(J(R.bin) === '["tokens","Tokens","2 of 4"]', `${label}: a token opens with the Tokens binder (made the first time), swipeable ${J(R.bin)}`);
    ok(R.defaultKept === "main", `${label}: picking a binder for a token doesn't change the default for cards (${R.defaultKept})`);
    ok(R.after[0] === "Tokens 1/4" && /1 of 4 tokens/.test(R.after[1]) && /own/.test(R.after[2]) && R.after[3] === "Otter", `${label}: added to the Tokens binder and lit up ${J(R.after)}`);
    ok(J(R.rows.slice().sort()) === '["blb:Tokens 1/4","cmm:"]', `${label}: the Sets list shows tokens under their set, not as a set of their own ${J(R.rows)}`);
    ok(R.value === 100, `${label}: tokens count toward the collection's value ($${(R.value / 100).toFixed(2)}: Sol Ring 0.50 + Otter 0.50)`);
    ok(R.quick === "tokens", `${label}: quick add on a token goes to the Tokens binder (${R.quick})`);
    ok(R.imp === "Krenko, Mob Boss→main×1, Treasure→tokens×2", `${label}: importing a list with a Tokens section puts the tokens in the Tokens binder (${R.imp})`);
    ok(J(R.deckTok) === J(["×1 Goblinfrom Krenko, Mob Boss [own]", "Missing Treasurefrom Smothering Tithe [missing]"]) && R.deckSum === "2 · you have 1", `${label}: Tokens this deck makes: which cards make them, and which you have (a Goblin from another set counts) ${J([R.deckTok, R.deckSum])}`);
    ok(R.deckTokBin === "tokens" && R.noFrom && J(R.deckTok2) === "[true,true]", `${label}: tapping a token you need adds it to the Tokens binder; it lights up ${J([R.deckTokBin, R.noFrom, R.deckTok2])}`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
