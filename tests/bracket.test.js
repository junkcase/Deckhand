// Commander bracket check and deck value history on the Balance tab.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const FIX = require("./real_decks_fixture.js");                                                  // read only: the 11 real decks
// the 11 real decks, MOCKED: Scryfall's Game Changers (its copy of Wizards' list, all 53 as of November 2026), its community tags (mass land denial: Wizards' own
// examples; extra turns: none of the decks has one), and the Commander Spellbook copy cut down to the 73 real combos found in these decks (ids, results and
// requirements as published on 20 November 2026)
const GC53 = ["Ad Nauseam", "Ancient Tomb", "Aura Shards", "Biorhythm", "Bolas's Citadel", "Braids, Cabal Minion", "Chrome Mox", "Coalition Victory", "Consecrated Sphinx", "Crop Rotation", "Cyclonic Rift", "Demonic Tutor", "Drannith Magistrate", "Enlightened Tutor", "Farewell", "Field of the Dead", "Fierce Guardianship", "Force of Will", "Gaea's Cradle", "Gamble", "Gifts Ungiven", "Glacial Chasm", "Grand Arbiter Augustin IV", "Grim Monolith", "Humility", "Imperial Seal", "Intuition", "Jeska's Will", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Mystical Tutor", "Narset, Parter of Veils", "Natural Order", "Necropotence", "Notion Thief", "Opposition Agent", "Orcish Bowmasters", "Panoptic Mirror", "Rhystic Study", "Seedborn Muse", "Serra's Sanctum", "Smothering Tithe", "Survival of the Fittest", "Teferi's Protection", "Tergrid, God of Fright // Tergrid's Lantern", "Thassa's Oracle", "The One Ring", "The Tabernacle at Pendrell Vale", "Underworld Breach", "Vampiric Tutor", "Worldly Tutor"];
const MLD5 = ["Armageddon", "Ruination", "Sunder", "Winter Orb", "Blood Moon"];
// a SYNTHETIC scenario built from three real Commander Spellbook records (published 20 November 2026), each two cards with nothing else needed but neither
// infinite nor a win: a lock (3263-5089), a near-infinite result (2484-4083) and "can't lose the game" (522-4551)
const COMBOS3 = {"as_of":"2026-11-20T10:39:38Z","source":"Commander Spellbook (commanderspellbook.com)","cards":["Karn, the Great Creator","Mycosynth Lattice","Blasphemous Act","Repercussion","Melira, Sylvok Outcast","Phyrexian Unlife"],"feats":["Lock","Mass Land Denial","Activated abilities can't be activated","Near-infinite damage to all players","You can't lose the game due to having 0 or less life"],"tmpl":[],"combos":[["3263-5089",[0,1],[0,1,2],[],23065,"C"],["2484-4083",[2,3],[3],[],40425,"R"],["522-4551",[4,5],[0,4],[],765,"GW"]]};
const COMBOS11 = {"as_of":"2026-11-20T10:39:38Z","source":"Commander Spellbook (commanderspellbook.com)","cards":["Restoration Angel","Felidar Guardian","Staff of Domination","Priest of Titania","Warren Soultrader","Pitiless Plunderer","Zulaport Cutthroat","Reassembling Skeleton","Cloud of Faeries","Deadeye Navigator","Peregrine Drake","Circle of Dreams Druid","Vraska, Betrayal's Sting","Vorinclex, Monstrous Raider","Innkeeper's Talent","Luminous Broodmoth","Viscera Seer","Carrion Feeder","Bartolomé del Presidio","Yahenni, Undying Partisan","Phyrexian Altar","Ashnod's Altar","Teysa Karlov","Drivnod, Carnage Dominus","Sifter of Skulls","Blood Artist","Bastion of Remembrance","Pawn of Ulamog","Teysa, Orzhov Scion","Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel","Archaeomancer","Ghostly Flicker","Elesh Norn, Mother of Machines","Panharmonicon","Venser, Shaper Savant","Reiterate","Jeska's Will","Wirewood Channeler","Mana Geyser","Mizzix of the Izmagnus","Frantic Search","Retreat to Coralhelm","Simic Growth Chamber","Sakura-Tribe Scout","Llanowar Scout","Marwyn, the Nurturer","Elvish Archdruid","Howlsquad Heavy","Brago, King Eternal","Strionic Resonator","Seething Song","Mikaeus, the Unhallowed","Yawgmoth, Thran Physician","Gray Merchant of Asphodel","Thousand-Year Storm","Storm-Kiln Artist","Brass's Bounty","Starfield Vocalist","Kiki-Jiki, Mirror Breaker","Thornbite Staff","Skirk Prospector","Krenko, Mob Boss","Goblin Warchief","Goblin Chieftain","Thousand-Year Elixir","Shorikai, Genesis Engine","Intruder Alarm","Cruel Celebrant","Goblin Bombardment","Conspicuous Snoop","Goblin Recruiter","Goblin Trashmaster"],"feats":["Infinite creature ETB","Infinite creature LTB","Infinite lifegain","Infinite card draw","Infinite green mana","Infinite lifeloss","Infinite artifact ETB","Infinite artifact LTB","Infinite blinking","Target opponent loses the game","Infinite scry 1","Infinite death triggers","Infinite colorless mana","Infinite storm count","Infinite blue mana","Infinite red mana","Infinite magecraft triggers","Infinite colored mana","Infinite looting","Infinite draw triggers","Infinite self-discard triggers","Infinite landfall triggers","Infinite blinking of nonland permanents","Near-infinite lifegain","Infinite damage","Infinite creature tokens","Near-infinite looting","Infinite creature tokens with haste"],"tmpl":["Creature with Persist or Undying","Persist Creature"],"combos":[["1090-2781",[0,1],[0,1],[],56338,"W"],["1376-2645",[2,3],[2,3,4],[],37967,"G"],["1385-1580-4871-5670",[4,5,6,7],[5,6,7],[],37780,"B"],["1409-1741",[8,9],[0,1],[],19535,"U"],["1409-3821",[10,9],[8,0,1],[],48858,"U"],["1526-2645",[2,11],[2,3,4],[],29148,"G"],["1529-1887",[12,13],[9],[],31310,"BG"],["1529-5902",[12,14],[9],[],15624,"BG"],["1580-2018-2292-4871",[15,5,16,7],[10,1,0],[],8605,"WB"],["1580-2018-2438-4871",[15,5,7,17],[1,0,11],[],6328,"WB"],["1580-2018-2921-4871",[15,5,7,18],[1,0,11],[],5422,"WB"],["1580-2018-3967-4871",[15,5,7,19],[1,0,11],[],4351,"WB"],["1580-2018-4050",[15,20,7],[1,0,11],[],5982,"WB"],["1580-2034-4871",[5,21,7],[0,1,12],[],66765,"B"],["1580-2292-4647-4871",[5,7,16,22],[10,1,0],[],14957,"WB"],["1580-2292-4871-5111",[5,7,16,23],[10,1,0],[],17013,"B"],["1580-2393-4050",[7,20,24],[0,1,11],[],8668,"B"],["1580-2438-4647-4871",[5,7,17,22],[1,0,11],[],10335,"WB"],["1580-2438-4871-5111",[5,7,17,23],[1,0,11],[],12432,"B"],["1580-2842-4871-5670",[4,5,7,25],[5,6,7],[],39151,"B"],["1580-2921-4647-4871",[5,7,18,22],[1,0,11],[],9232,"WB"],["1580-2921-4871-5111",[5,7,18,23],[1,0,11],[],4288,"WB"],["1580-3025-4871-5670",[4,5,7,26],[5,6,7],[],27206,"B"],["1580-3967-4647-4871",[5,7,19,22],[1,0,11],[],6699,"WB"],["1580-3967-4871-5111",[5,7,19,23],[1,0,11],[],6172,"B"],["1580-4050-4314",[7,20,27],[0,1,11],[],24220,"B"],["1580-4050-4619",[28,20,7],[1,0,11],[],6875,"WB"],["1580-4050-4871",[5,7,20],[0,1,11],[],43324,"B"],["1580-4871-5670-6578",[4,5,7,29],[5,6,7],[],21121,"B"],["1741-1770-1987-2493",[8,30,31,32],[13,0,1],[],2592,"WU"],["1741-1987-2397-2493",[8,30,31,33],[13,0,1],[],7946,"U"],["1770-3634-3821",[10,32,34],[14,13,1],[],6874,"WU"],["1878-3368",[35,36],[15,13,16],[],39005,"R"],["1902-2645",[2,37],[2,3,17],[],15121,"G"],["1987-2493-3821",[31,10,30],[8,13,0],[],38701,"U"],["2018-2034--73",[15,21],[1,0,11],[0],32623,"W"],["2018-2292--73",[15,16],[10,1,0],[0],27461,"WB"],["2018-2438--73",[15,17],[1,0,11],[0],17210,"WB"],["2018-2921--73",[15,18],[1,0,11],[0],16438,"WB"],["2018-3967--73",[15,19],[1,0,11],[0],11581,"WB"],["2018-4050--73",[15,20],[1,0,17],[0],18685,"W"],["2091-3368",[35,38],[15,13,16],[],31427,"R"],["2196-3075-3368",[39,40,35],[18,19,20],[],2896,"UR"],["224-1671-3177",[41,42,43],[21],[],12326,"GU"],["224-433-1671",[41,44,42],[21],[],8201,"GU"],["2397-3634-3821",[10,33,34],[14,13,0],[],18179,"U"],["2436-2645",[2,45],[2,3,4],[],33012,"G"],["2645-3151",[2,46],[2,3,4],[],34405,"G"],["2645-6410",[2,47],[2,15,3],[],6856,"R"],["2751-3557",[48,49],[0,1,22],[],12591,"WU"],["3075-3368-4036",[39,50,35],[15,13,16],[],2652,"UR"],["328-628-4279",[51,52,53],[3,19,23],[],15823,"B"],["3368-3584",[54,35],[16],[],11054,"UR"],["3368-4036-5195",[55,50,35],[13,6,7],[],30219,"R"],["3368-5211",[35,56],[13,17,16],[],7345,"R"],["3634-3821-6751",[10,34,57],[14,13,1],[],9540,"U"],["38-618-2178",[58,59,60],[15,0,1],[],9189,"R"],["38-659-1288",[-62,60,62],[15,13,0],[],36094,"R"],["38-659-2178",[61,59,60],[24,15,25],[],13748,"R"],["38-659-2645",[60,61,2],[2,15,3],[],12567,"R"],["38-659-3954",[-62,60,63],[15,13,0],[],32048,"R"],["38-659-5295",[-62,60,64],[15,13,1],[],14060,"R"],["38-659-6410",[-62,60,47],[15,13,1],[],17956,"R"],["467-1636",[65,66],[19,20,26],[],7105,"WU"],["483-1580-4871-5670",[4,5,67,7],[5,6,7],[],8484,"WB"],["618-2178-5147",[58,59,68],[24,0,1],[],9319,"R"],["618-2240-2943",[69,58,70],[0,27],[],21144,"R"],["628-2034--5",[51,21],[0,1,12],[1],47961,"B"],["628-2292--5",[51,16],[10,0,1],[1],33706,"B"],["628-2438--5",[51,17],[0,1,11],[1],41818,"B"],["628-2842-5670--5",[51,4,25],[5,6,7],[1],16858,"B"],["659-2178-2813",[61,59,71],[0,1,11],[],10046,"R"],["659-2178-5147",[61,59,68],[24,0,1],[],12830,"R"]]};
const GC = ["Rhystic Study", "Smothering Tithe", "Demonic Tutor", "Cyclonic Rift", "Farewell"], XT = ["Time Warp", "Temporal Manipulation", "Capture of Jingzhou", "Temporal Mastery"], MLD = ["Armageddon"];
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8790", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], qs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 404, body: "" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = j => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("/cards/search")) { if (/is:gamechanger|otag:/.test(u)) qs.push(u); const L = /is:gamechanger/.test(u) ? GC : /otag:extra-turn/.test(u) ? XT : /otag:mass-land-denial/.test(u) ? MLD : []; return J({ object: "list", has_more: false, data: L.map(name => ({ name })) }); }
    if (u.includes("/cards/collection")) return J({ data: [], not_found: [] });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.goto("http://127.0.0.1:8790/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  const setDeck = cards => p.evaluate(cards => {
    const mk = (n, t = "Instant") => slim({ id: "id-" + n.replace(/\W/g, ""), oracle_id: "o" + n, name: n, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: t, cmc: 2, mana_cost: "{2}", colors: [], color_identity: [], prices: { usd: "2" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "", normal: "" } });
    const d = S.decks.c = { id: "c", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1, vh: S.decks.c && S.decks.c.vh };
    for (const n of cards) addToDeck(d, mk(n), 1, false);
    S.roles = { "Vampiric Tutor": ["Tutor"], "Enlightened Tutor": ["Tutor"], "Mystical Tutor": ["Tutor"], "Worldly Tutor": ["Tutor"] };
    staleIndex(); deckTab.c = "balance"; save(); go("decks", "c");
  }, cards);
  const box = async () => { await p.waitForFunction(() => document.querySelector("#brBox") && !/Checking/.test(document.querySelector("#brBox").textContent), null, { timeout: 8000 }); return p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ")); };
  await setDeck(["Sol Ring", "Counterspell"]); R.b2 = await box(); R.queries = qs.length;
  await setDeck(["Rhystic Study", "Farewell", "Time Warp"]); R.b3 = await box();
  await setDeck(GC); R.b4 = await box();
  await setDeck(["Armageddon"]); R.mld = await box();
  await setDeck(XT); R.xt = await box();
  await setDeck(["Vampiric Tutor", "Enlightened Tutor", "Mystical Tutor", "Worldly Tutor"]); R.tut = await box();
  R.queries2 = qs.length;
  // deck value history
  R.noHist = await p.$eval("#dPane", e => /value chart starts once prices have updated on two different days/.test(e.textContent));
  await p.evaluate(() => { const T = today(); S.decks.c.vh = [[T - 40, 20], [T - 10, 30], [T - 2, 25], [T, 8]]; renderDeck(S.decks.c); });
  R.hist = await p.$eval("#dPane", e => e.textContent.replace(/\s+/g, " ").match(/Deck value.*?Includes cards/)?.[0]);
  R.spark = !!(await p.$("#dPane svg.spark"));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.evaluate(async () => { S.meta.pricedAt = 0; await refreshPrices(true); });
  R.recorded = await p.evaluate(() => { const h = S.decks.c.vh; return [h.length, h.at(-1)[0] === today(), h.at(-1)[1]]; });
  // not a Commander deck: no bracket box
  await p.evaluate(() => { S.decks.c.format = "modern"; renderDeck(S.decks.c); }); R.noBox = !(await p.$("#brBox"));
  R.errs = errs; await b.close(); srv.kill(); return R;
}
// the 11 real decks, each one's bracket box as the Balance tab shows it
async function run11(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8791", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  const J = (r, j) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 404, body: "" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/cards/search")) return J(r, { object: "list", has_more: false, data: (/is:gamechanger/.test(u) ? GC53 : /otag:mass-land-denial/.test(u) ? MLD5 : /otag:extra-turn/.test(u) ? XT : []).map(name => ({ name })) });
    if (u.includes("/cards/collection")) return J(r, { data: [], not_found: [] });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1]; return k === "combos/meta.json" ? J(r, { as_of: COMBOS11.as_of, combos: COMBOS11.combos.length }) : k === "combos/all.json" ? J(r, COMBOS11) : r.fulfill({ status: 404, body: "" }); });
  await p.goto("http://127.0.0.1:8791/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  for (const [id, list] of Object.entries(FIX.decks)) {
    await p.evaluate(({ id, list, cards }) => {
      const mk = c => slim({ ...c, legalities: { commander: "legal" }, prices: {}, finishes: ["nonfoil"], image_uris: { small: "", normal: "" } });    // as adding the card from Scryfall does
      const d = S.decks[id] = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
      const [cmd, ...rest] = list; addToDeck(d, mk(cards[cmd[0]]), 1, false, true); d.cmdr = Object.keys(d.cards);
      for (const [n, q] of rest) addToDeck(d, mk(cards[n]), q, false, true);
      deckTab[id] = "balance"; balMode[id] = ""; go("decks", id);
    }, { id, list, cards: FIX.cards });
    await p.waitForFunction(() => { const t = (document.querySelector("#brBox") || {}).textContent || ""; return t && !/Checking/.test(t) && !document.querySelector("#brPrelim"); }, null, { timeout: 15000 });
    R[id] = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim());
    if (id === "teysa") { const st = () => p.$eval("#brNeed", e => ({ open: e.open, h: Math.round(e.getBoundingClientRect().height), rows: e.querySelector("div").checkVisibility() })); R.need0 = await st(); await p.click("#brNeed summary"); R.need1 = await st(); }
    // the same deck if the community tag didn't list Blood Moon: the bracket box as it would show, and the evidence left once its qualifying combos are set aside too
    Object.assign(R, await p.evaluate(id => { const d = S.decks[id], L = BRK.lists, noBM = { gc: L.gc, xt: L.xt, mld: new Set([...L.mld].filter(n => n !== "Blood Moon")) };
      BRK.lists = noBM; const box = document.createElement("div"); box.innerHTML = bracketHTML(d); BRK.lists = L;
      const r = bracketOf(d, noBM);
      return { [id + ":noBloodMoon"]: box.textContent.replace(/\s+/g, " ").trim(), [id + ":neither"]: { b: r.b, why: r.why, gc: r.gc, mld: r.mld, xt: r.xt } }; }, id));
  }
  R.errs = errs; await b.close(); srv.kill(); return R;
}
// the combo list late (held until released), failed, or a SYNTHETIC deck of the three non-qualifying records; Lathril and Wyleth also side by side in Compare
async function runStates(opts, mode) {
  const srv = spawn("python3", ["-m", "http.server", "8792", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = []; let release; const gate = new Promise(r => release = r);
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script|combo list/.test(m.text())) errs.push(m.text()); });
  const J = (r, j) => r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) }), data = mode === "synthetic" ? COMBOS3 : COMBOS11;
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 404, body: "" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/cards/search")) return J(r, { object: "list", has_more: false, data: (/is:gamechanger/.test(u) ? GC53 : /otag:mass-land-denial/.test(u) ? MLD5 : /otag:extra-turn/.test(u) ? XT : []).map(name => ({ name })) });
    r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", async r => { const k = r.request().url().split("/data/")[1];
    if (k === "combos/meta.json") return J(r, { as_of: data.as_of, combos: data.combos.length });
    if (k !== "combos/all.json") return r.fulfill({ status: 404, body: "" });
    if (mode === "fail") return r.fulfill({ status: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
    if (mode === "delay") await gate; return J(r, data); });
  await p.goto("http://127.0.0.1:8792/app_real.html"); await p.waitForTimeout(500);
  const add = (id, cards) => p.evaluate(({ id, cards }) => { const mk = c => slim({ ...c, legalities: { commander: "legal" }, prices: {}, finishes: ["nonfoil"], image_uris: { small: "", normal: "" } });
    const d = S.decks[id] = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; for (const c of cards) addToDeck(d, mk(c), 1, false, true); }, { id, cards });
  const real = id => FIX.decks[id].map(([n]) => FIX.cards[n]);
  const boxOf = async id => { await p.evaluate(id => { closeSheet(); deckTab[id] = "balance"; balMode[id] = ""; go("decks", id); }, id); await p.waitForFunction(() => /Commander bracket/.test((document.querySelector("#brBox") || {}).textContent || "") && !/Checking/.test(document.querySelector("#brBox").textContent)); return p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim()); };
  const cells = () => p.$$eval("table.cmp tbody tr", rows => { const r = rows.find(tr => tr.children[0].textContent.trim() === "Bracket (estimate)"); return r ? [r.children[1].textContent.trim(), r.children[2].textContent.trim()] : null; });
  const R = {};
  if (mode === "synthetic") {
    await add("syn", ["Karn, the Great Creator", "Mycosynth Lattice", "Blasphemous Act", "Repercussion", "Melira, Sylvok Outcast", "Phyrexian Unlife"].map(name => ({ id: "s-" + name.replace(/\W/g, ""), oracle_id: "o-" + name, name, type_line: "Artifact", set: "cmm", collector_number: "1", rarity: "rare", cmc: 3, mana_cost: "{3}", colors: [], color_identity: [] })));
    await p.evaluate(() => go("decks", "syn")); R.syn = await boxOf("syn"); await p.waitForFunction(() => !document.querySelector("#brPrelim")); R.syn = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim());
  } else {
    await add("lathril", real("lathril")); await p.evaluate(() => { S.decks.lathril.cmdr = [Object.keys(S.decks.lathril.cards)[0]]; }); await add("wyleth", real("wyleth")); await p.evaluate(() => { S.decks.wyleth.cmdr = [Object.keys(S.decks.wyleth.cards)[0]]; });
    R.box0 = await boxOf("lathril");
    if (mode === "fail") await p.waitForFunction(() => /couldn't be checked/.test((document.querySelector("#brPrelim") || {}).textContent || "")), R.box0 = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim());
    await p.evaluate(() => compareSheet("lathril", "wyleth")); await p.waitForSelector("table.cmp"); await p.waitForTimeout(300); R.cmp0 = await cells();
    if (mode === "delay") {
      release(); await p.waitForFunction(() => { const r = [...document.querySelectorAll("table.cmp tbody tr")].find(tr => tr.children[0].textContent.trim() === "Bracket (estimate)"); return r && r.children[1].textContent.trim() !== "…"; });
      R.cmp1 = await cells(); await p.waitForFunction(() => !document.querySelector("#brPrelim")); R.box1 = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim());   // the box under the sheet, redrawn in place
      R.wyleth = await boxOf("wyleth");
    }
  }
  R.errs = errs; await b.close(); srv.kill(); return R;
}
const head = t => (t.match(/^Commander bracket ?(.*? or (higher|lower))/) || [])[1];
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "bracket_phone.png"]]) {
    const R = await run(opts, shot);
    ok(/2 \(Core\) or lower/.test(R.b2) && /two-card combos/i.test(R.b2) && R.queries === 3, `${label}: nothing notable → 2 or lower, combos named as not checked (${R.queries} lookups)`);
    ok(/3 \(Upgraded\) or higher/.test(R.b3) && /Game Changers \(2\): Rhystic Study, Farewell/.test(R.b3) && /Extra turns \(1\): Time Warp \(Scryfall community tag\)/.test(R.b3), `${label}: 2 Game Changers → 3 or higher, cards listed, extra turns marked as a community tag (${R.b3.slice(0, 160)})`);
    ok(/Your judgment: whether a combo is in the deck on purpose, whether it can come together early in the game, and how long games with this deck usually last/.test(R.b3) && /community card tags, not official Wizards lists/.test(R.b3), `${label}: intent, early combos and game length are left to the player; the community tags are named as such`);
    ok(/4 \(Optimized\) or higher/.test(R.b4) && /5 Game Changers \(bracket 3 allows up to 3\)/.test(R.b4), `${label}: 5 Game Changers → 4`);
    ok(/4 \(Optimized\) or higher/.test(R.mld) && /mass land denial/.test(R.mld) && /Mass land denial \(1\): Armageddon \(Scryfall community tag\)/.test(R.mld), `${label}: mass land denial → 4, marked as a community tag`);
    ok(/4 \(Optimized\) or higher/.test(R.xt) && /Sets the minimum, 4 \(Optimized\) or higher: 4 extra-turn cards \(Deckhand's estimate: 4 or more could chain extra turns; Wizards asks brackets 1–3 not to chain them but sets no number\)\./.test(R.xt) && !/extra-turn cards \(Deckhand/.test(R.b3), `${label}: 4 extra-turn cards → 4, labelled as Deckhand's estimate (Wizards sets no number); one extra-turn card (Time Warp) doesn't raise it`);
    ok(/2 \(Core\) or lower/.test(R.tut) && /Tutors \(4\): Vampiric Tutor, Enlightened Tutor, Mystical Tutor, Worldly Tutor \(listed for reference: tutors don't change the bracket\)/.test(R.tut) && !/because of/i.test(R.tut), `${label}: 4 tutors are listed, but no longer raise the bracket (Wizards removed tutor limits in October 2025) (${R.tut.slice(0, 200)})`);
    ok(R.queries2 === 3, `${label}: the lists are loaded once and reused`);
    ok(R.noHist, `${label}: no value chart until there are two days of prices`);
    ok(R.hist && /−\$12\.00 since/.test(R.hist) && /7 days: −\$22\.00/.test(R.hist) && /30 days: −\$12\.00/.test(R.hist) && R.spark, `${label}: value chart with 7 and 30 day changes (${R.hist})`);
    ok(R.recorded[0] === 4 && R.recorded[1] && R.recorded[2] === 8, `${label}: Update prices records today's deck value ${JSON.stringify(R.recorded)}`);
    ok(R.noBox, `${label}: no bracket box for non-Commander decks`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
    // ---- Stage 2J-1: the 11 real decks
    const D = await run11(opts);
    const want = { krenko: "4 (Optimized) or higher", mizzix: "4 (Optimized) or higher", shorikai: "4 (Optimized) or higher", atraxa: "4 (Optimized) or higher", teysa: "3 (Upgraded) or higher", tatyova: "3 (Upgraded) or higher", brago: "3 (Upgraded) or higher", lathril: "3 (Upgraded) or higher", sythis: "3 (Upgraded) or higher", meren: "2 (Core) or lower", wyleth: "2 (Core) or lower" };
    for (const id in want) ok(head(D[id]) === want[id], `${label}: 2J-1 ${id}: ${want[id]} (${head(D[id])})`);
    // the evidence that sets the minimum, said first
    for (const [id, n] of [["mizzix", "4 two-card combos"], ["shorikai", "1 two-card combo"], ["atraxa", "2 two-card combos"]]) ok(D[id].includes(`Sets the minimum, 4 (Optimized) or higher: 4 Game Changers (bracket 3 allows up to 3).Also found: ${n} (brackets 1–2 allow none; bracket 3 none early in the game) → 3 (Upgraded) or higher.`), `${label}: 2J-1 ${id}: 4 because of its 4 Game Changers; its ${n} also found, pointing only to 3`);
    for (const id of ["teysa", "tatyova"]) ok(/Sets the minimum, 3 \(Upgraded\) or higher: 2 Game Changers \(brackets 1–2 allow none\)\./.test(D[id]) && !/Also found/.test(D[id]), `${label}: 2J-1 ${id}: 3 because of its 2 Game Changers`);
    ok(/Sets the minimum, 3 \(Upgraded\) or higher: 2 Game Changers \(brackets 1–2 allow none\); 4 two-card combos \(brackets 1–2 allow none; bracket 3 none early in the game\) \(each of these on its own\)\./.test(D.brago) && /Game Changers \(2\): /.test(D.brago) && /Two-card combos \(4\): /.test(D.brago), `${label}: 2J-2 Brago: its Game Changers and its combos each set 3 on their own, and are listed apart`);
    ok(/Sets the minimum, 3 \(Upgraded\) or higher: 1 Game Changer \(brackets 1–2 allow none\)\./.test(D.sythis) && /Game Changers \(1\): Enlightened Tutor/.test(D.sythis) && /Tutors \(5\): Moon-Blessed Cleric, Sterling Grove, Eladamri's Call, Enlightened Tutor, Idyllic Tutor \(listed for reference: tutors don't change the bracket\)/.test(D.sythis), `${label}: 2J-1 Sythis: 3 because Enlightened Tutor is a Game Changer, not because of its 5 tutors`);
    ok(/No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(D.wyleth) && /Tutors \(6\): Sunforger, Relic Seeker, Stoneforge Mystic, Open the Armory, Steelshaper's Gift, Fighter Class \(listed for reference/.test(D.wyleth), `${label}: 2J-1 Wyleth: its 6 tutors no longer make it 3`);
    // combos that need more: closed, counted, grouped by what they still need, one per line with what Spellbook says they give
    ok(/No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(D.meren) && !/Two-card combos \(/.test(D.meren) && /Two-card combos that need more \(3\) — not counted: each needs something more, or doesn't go infinite or win ?Also needs Persist Creature \(3\): /.test(D.meren)
      && ["Mikaeus, the Unhallowed + Ashnod's Altar — Infinite creature ETB; Infinite creature LTB; Infinite colorless mana", "Mikaeus, the Unhallowed + Viscera Seer — Infinite scry 1; Infinite creature ETB; Infinite creature LTB", "Mikaeus, the Unhallowed + Carrion Feeder — Infinite creature ETB; Infinite creature LTB; Infinite death triggers"].every(x => D.meren.includes(x)) && /Tutors \(4\)/.test(D.meren), `${label}: 2J-2 Meren: its three Mikaeus combos need a persist creature too: listed apart with what they give, not counted; nor are its 4 tutors`);
    ok(!/Two-card combos \(/.test(D.teysa) && /Two-card combos that need more \(6\) — not counted: each needs something more, or doesn't go infinite or win ?Also needs Creature with Persist or Undying \(6\): /.test(D.teysa)
      && ["Luminous Broodmoth + Ashnod's Altar — Infinite creature LTB; Infinite creature ETB; Infinite death triggers", "Luminous Broodmoth + Viscera Seer — Infinite scry 1; Infinite creature LTB; Infinite creature ETB", "Luminous Broodmoth + Carrion Feeder — Infinite creature LTB; Infinite creature ETB; Infinite death triggers", "Luminous Broodmoth + Bartolomé del Presidio — Infinite creature LTB; Infinite creature ETB; Infinite death triggers", "Luminous Broodmoth + Yahenni, Undying Partisan — Infinite creature LTB; Infinite creature ETB; Infinite death triggers", "Luminous Broodmoth + Phyrexian Altar — Infinite creature LTB; Infinite creature ETB; Infinite colored mana"].every(x => D.teysa.includes(x)), `${label}: 2J-2 Teysa: its six Luminous Broodmoth combos need a persist or undying creature too: listed apart with what they give, not counted`);
    ok(D.need0 && !D.need0.open && !D.need0.rows && D.need1.open && D.need1.rows && D.need1.h > D.need0.h + 50, `${label}: 2J-2 the section of combos that need more starts closed and opens on a tap (${JSON.stringify([D.need0, D.need1])})`);
    const need = Object.keys(want).reduce((a, id) => a + +((D[id].match(/Two-card combos that need more \((\d+)\)/) || [0, 0])[1]), 0);
    ok(need === 9, `${label}: 2J-1 all 9 combos that need a third piece are kept out of the two-card combos (${need})`);
    ok(/Sets the minimum, 3 \(Upgraded\) or higher: 5 two-card combos \(brackets 1–2 allow none; bracket 3 none early in the game\)\./.test(D.lathril) && /Two-card combos \(5\): Staff of Domination \+ Priest of Titania — Infinite lifegain; Infinite card draw; Infinite green mana/.test(D.lathril)
      && ["Staff of Domination + Elvish Archdruid — Infinite lifegain; Infinite card draw; Infinite green mana", "Staff of Domination + Marwyn, the Nurturer — Infinite lifegain; Infinite card draw; Infinite green mana", "Staff of Domination + Circle of Dreams Druid — Infinite lifegain; Infinite card draw; Infinite green mana", "Staff of Domination + Wirewood Channeler — Infinite lifegain; Infinite card draw; Infinite colored mana"].every(x => D.lathril.includes(x)), `${label}: 2J-1 Lathril: 3 because of its five Staff of Domination combos, which still count, each with what it gives`);
    // Krenko: what sets its minimum is the evidence, not a fixed number; the combo is "also found", not a second reason for 4
    ok(head(D.krenko) === "4 (Optimized) or higher" && /Sets the minimum, 4 \(Optimized\) or higher: mass land denial \(only bracket 4 and up\)\. ?Also found: 1 two-card combo \(brackets 1–2 allow none; bracket 3 none early in the game\) → 3 \(Upgraded\) or higher\./.test(D.krenko) && /Mass land denial \(1\): Blood Moon \(Scryfall community tag\)/.test(D.krenko), `${label}: 2J-1 Krenko with Blood Moon in the (mocked) community tag: 4 or higher, set by that mass-land-denial card; its combo is also found, pointing to 3`);
    const nb = D["krenko:noBloodMoon"];
    ok(head(nb) === "3 (Upgraded) or higher" && /Sets the minimum, 3 \(Upgraded\) or higher: 1 two-card combo \(brackets 1–2 allow none; bracket 3 none early in the game\)\./.test(nb) && /Two-card combos \(1\): Staff of Domination \+ Howlsquad Heavy — Infinite lifegain; Infinite red mana; Infinite card draw/.test(nb) && !/Mass land denial \(|Also found/.test(nb), `${label}: 2J-1 Krenko without Blood Moon in the tag: 3 or higher, because its qualifying Staff of Domination + Howlsquad Heavy combo remains (${head(nb)})`);
    const ne = D["krenko:neither"], neWant = ne.gc.length > 3 || ne.mld.length || ne.xt.length >= 4 ? 4 : ne.gc.length ? 3 : 2;
    ok(ne.b === neWant && ne.why.length === (ne.gc.length ? 1 : 0) + (ne.mld.length ? 1 : 0) + (ne.xt.length >= 4 ? 1 : 0) && !ne.mld.length, `${label}: 2J-1 Krenko without either (no Blood Moon, combos set aside): the minimum follows the evidence left (Game Changers ${ne.gc.length}, mass land denial ${ne.mld.length}, extra turns ${ne.xt.length}) → ${ne.b}${ne.why.length ? ": " + ne.why.join("; ") : ", nothing left that limits it"}`);
    ok(Object.keys(want).every(id => !/Sets the minimum[^.]*tutor/i.test(D[id]) && /Your judgment:/.test(D[id])), `${label}: 2J-1 no deck's bracket comes from tutors, and every box leaves intent, early combos and game length to the player`);
    ok(Object.keys(want).every(id => D[id].includes("For context, Wizards' guide is that games should last at least 9 turns in bracket 1, 8 in bracket 2, 6 in bracket 3 and 4 in bracket 4: something for you to weigh, not something Deckhand measures.")), `${label}: 2J-2 Wizards' game-length guide is given as context, not as something Deckhand measures`);
    ok(!D.errs.length, `${label}: 2J-1 no console errors ${JSON.stringify(D.errs)}`);
    // ---- Stage 2J-2: before the combo list is in, when it's in, and when it fails
    const L = await runStates(opts, "delay"), F = await runStates(opts, "fail"), Y = await runStates(opts, "synthetic");
    ok(head(L.box0) === "2 (Core) or lower" && /Preliminary result — combos not checked yet\. Until the combo list has loaded, a two-card combo in the deck could still make the minimum higher\./.test(L.box0) && /No Game Changers, mass land denial, chains of extra turns found\./.test(L.box0) && !/two-card combos found/.test(L.box0), `${label}: 2J-2 while the combo list loads, Lathril's result is marked preliminary and doesn't claim there are no combos`);
    ok(JSON.stringify(L.cmp0) === '["…","…"]', `${label}: 2J-2 Compare shows … until the combo list is in (${JSON.stringify(L.cmp0)})`);
    ok(head(L.box1) === "3 (Upgraded) or higher" && !/Preliminary/.test(L.box1) && /Sets the minimum, 3 \(Upgraded\) or higher: 5 two-card combos/.test(L.box1), `${label}: 2J-2 once it's in, the box turns into the final result in place: 3 or higher (${head(L.box1)})`);
    ok(JSON.stringify(L.cmp1) === '["3 or higher","2 or lower"]', `${label}: 2J-2 Compare then says what the Balance tab says, under the same "Bracket (estimate)" label (${JSON.stringify(L.cmp1)})`);
    ok(head(L.wyleth) === "2 (Core) or lower" && !/Preliminary/.test(L.wyleth) && /No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(L.wyleth), `${label}: 2J-2 combo list in and nothing qualifying (Wyleth): a final 2 or lower, combos checked`);
    ok(head(F.box0) === "2 (Core) or lower" && /Preliminary result — two-card combos couldn't be checked\. The combo list didn't load, so a two-card combo in the deck could still make the minimum higher\./.test(F.box0) && !/two-card combos found/.test(F.box0), `${label}: 2J-2 if the combo list fails to load, the box says combos couldn't be checked; it doesn't pass for "no combos"`);
    ok(JSON.stringify(F.cmp0) === '["2 or lower (combos not checked)","2 or lower (combos not checked)"]', `${label}: 2J-2 …and Compare says so too (${JSON.stringify(F.cmp0)})`);
    ok(head(Y.syn) === "2 (Core) or lower" && /No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(Y.syn) && !/Two-card combos \(/.test(Y.syn) && /Two-card combos that need more \(3\) — not counted: each needs something more, or doesn't go infinite or win ?Doesn't go infinite or win \(3\): /.test(Y.syn)
      && ["Blasphemous Act + Repercussion — Near-infinite damage to all players", "Karn, the Great Creator + Mycosynth Lattice — Lock; Mass Land Denial; Activated abilities can't be activated", "Melira, Sylvok Outcast + Phyrexian Unlife — Lock; You can't lose the game due to having 0 or less life"].every(x => Y.syn.includes(x)), `${label}: 2J-2 synthetic (real Spellbook records): a lock, a near-infinite result and "can't lose the game" are two cards with nothing else needed, yet none qualifies; each is listed with what it gives`);
    ok(![L, F, Y].some(x => x.errs.length), `${label}: 2J-2 no console errors ${JSON.stringify([L.errs, F.errs, Y.errs])}`);
  }
})();
