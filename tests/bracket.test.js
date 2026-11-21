// Commander bracket check and deck value history on the Balance tab.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const FIX = require("./real_decks_fixture.js");                                                  // read only: the 11 real decks
// the 11 real decks, MOCKED: Scryfall's Game Changers (its copy of Wizards' list, all 53 as of November 2026), its community tags (mass land denial: Wizards' own
// examples; extra turns: none of the decks has one), and the Commander Spellbook copy cut down to the 73 real combos found in these decks (ids, results and
// requirements as published on 20 November 2026)
const GC53 = ["Ad Nauseam", "Ancient Tomb", "Aura Shards", "Biorhythm", "Bolas's Citadel", "Braids, Cabal Minion", "Chrome Mox", "Coalition Victory", "Consecrated Sphinx", "Crop Rotation", "Cyclonic Rift", "Demonic Tutor", "Drannith Magistrate", "Enlightened Tutor", "Farewell", "Field of the Dead", "Fierce Guardianship", "Force of Will", "Gaea's Cradle", "Gamble", "Gifts Ungiven", "Glacial Chasm", "Grand Arbiter Augustin IV", "Grim Monolith", "Humility", "Imperial Seal", "Intuition", "Jeska's Will", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Mystical Tutor", "Narset, Parter of Veils", "Natural Order", "Necropotence", "Notion Thief", "Opposition Agent", "Orcish Bowmasters", "Panoptic Mirror", "Rhystic Study", "Seedborn Muse", "Serra's Sanctum", "Smothering Tithe", "Survival of the Fittest", "Teferi's Protection", "Tergrid, God of Fright // Tergrid's Lantern", "Thassa's Oracle", "The One Ring", "The Tabernacle at Pendrell Vale", "Underworld Breach", "Vampiric Tutor", "Worldly Tutor"];
const MLD5 = ["Armageddon", "Ruination", "Sunder", "Winter Orb", "Blood Moon"];
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
    await p.waitForFunction(() => { const t = (document.querySelector("#brBox") || {}).textContent || ""; return t && !/Checking|loading the combo list/.test(t); }, null, { timeout: 15000 });
    R[id] = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " ").trim());
    // the same deck if the community tag didn't list Blood Moon: the bracket box as it would show, and the evidence left once its qualifying combos are set aside too
    Object.assign(R, await p.evaluate(id => { const d = S.decks[id], L = BRK.lists, noBM = { gc: L.gc, xt: L.xt, mld: new Set([...L.mld].filter(n => n !== "Blood Moon")) };
      BRK.lists = noBM; const box = document.createElement("div"); box.innerHTML = bracketHTML(d); BRK.lists = L;
      const r = bracketOf(d, noBM);
      return { [id + ":noBloodMoon"]: box.textContent.replace(/\s+/g, " ").trim(), [id + ":neither"]: { b: r.b, why: r.why, gc: r.gc, mld: r.mld, xt: r.xt } }; }, id));
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
    ok(/4 \(Optimized\)/.test(R.xt) && /4 extra-turn cards/.test(R.xt), `${label}: 4 extra-turn cards → 4`);
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
    for (const id of ["mizzix", "shorikai", "atraxa"]) ok(/because of 4 Game Changers \(bracket 3 allows up to 3\)/.test(D[id]), `${label}: 2J-1 ${id}: 4 because of its 4 Game Changers`);
    for (const id of ["teysa", "tatyova", "brago"]) ok(/because of 2 Game Changers \(brackets 1–2 allow none\)/.test(D[id]), `${label}: 2J-1 ${id}: 3 because of its 2 Game Changers`);
    ok(/because of 1 Game Changer \(brackets 1–2 allow none\)\./.test(D.sythis) && /Game Changers \(1\): Enlightened Tutor/.test(D.sythis) && /Tutors \(5\): Moon-Blessed Cleric, Sterling Grove, Eladamri's Call, Enlightened Tutor, Idyllic Tutor \(listed for reference: tutors don't change the bracket\)/.test(D.sythis), `${label}: 2J-1 Sythis: 3 because Enlightened Tutor is a Game Changer, not because of its 5 tutors`);
    ok(/No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(D.wyleth) && /Tutors \(6\): Sunforger, Relic Seeker, Stoneforge Mystic, Open the Armory, Steelshaper's Gift, Fighter Class \(listed for reference/.test(D.wyleth), `${label}: 2J-1 Wyleth: its 6 tutors no longer make it 3`);
    ok(/No Game Changers, mass land denial, chains of extra turns or two-card combos found\./.test(D.meren) && !/Two-card combos \(/.test(D.meren) && /Two-card combos that need more \(3\): Mikaeus, the Unhallowed \+ Ashnod's Altar \(also needs Persist Creature\), Mikaeus, the Unhallowed \+ Carrion Feeder \(also needs Persist Creature\), Mikaeus, the Unhallowed \+ Viscera Seer \(also needs Persist Creature\) \(these don't count/.test(D.meren) && /Tutors \(4\)/.test(D.meren), `${label}: 2J-1 Meren: its three Mikaeus combos need a persist creature too, so they're listed apart and don't count; nor do its 4 tutors`);
    ok(!/Two-card combos \(/.test(D.teysa) && /Two-card combos that need more \(6\): Luminous Broodmoth \+ Ashnod's Altar \(also needs Creature with Persist or Undying\)/.test(D.teysa) && (D.teysa.match(/also needs Creature with Persist or Undying/g) || []).length === 6, `${label}: 2J-1 Teysa: its six Luminous Broodmoth combos need a persist or undying creature too: listed apart, not counted`);
    const need = Object.keys(want).reduce((a, id) => a + (D[id].match(/\(also needs /g) || []).length, 0);
    ok(need === 9, `${label}: 2J-1 all 9 combos that need a third piece are kept out of the two-card combos (${need})`);
    ok(/because of 5 two-card combos \(brackets 1–2 allow none; bracket 3 none early in the game\)\./.test(D.lathril) && /Two-card combos \(5\): Staff of Domination \+ Priest of Titania, Staff of Domination \+ Elvish Archdruid, Staff of Domination \+ Marwyn, the Nurturer, Staff of Domination \+ Circle of Dreams Druid, Staff of Domination \+ Wirewood Channeler/.test(D.lathril), `${label}: 2J-1 Lathril: 3 because of its five Staff of Domination combos, which still count`);
    // Krenko: what sets its minimum is the evidence, not a fixed number
    ok(head(D.krenko) === "4 (Optimized) or higher" && /because of mass land denial \(only bracket 4 and up\); 1 two-card combo/.test(D.krenko) && /Mass land denial \(1\): Blood Moon \(Scryfall community tag\)/.test(D.krenko), `${label}: 2J-1 Krenko with Blood Moon in the (mocked) community tag: 4 or higher, because of that mass-land-denial card`);
    const nb = D["krenko:noBloodMoon"];
    ok(head(nb) === "3 (Upgraded) or higher" && /because of 1 two-card combo \(brackets 1–2 allow none; bracket 3 none early in the game\)\./.test(nb) && /Two-card combos \(1\): Staff of Domination \+ Howlsquad Heavy/.test(nb) && !/Mass land denial \(/.test(nb), `${label}: 2J-1 Krenko without Blood Moon in the tag: 3 or higher, because its qualifying Staff of Domination + Howlsquad Heavy combo remains (${head(nb)})`);
    const ne = D["krenko:neither"], neWant = ne.gc.length > 3 || ne.mld.length || ne.xt.length >= 4 ? 4 : ne.gc.length ? 3 : 2;
    ok(ne.b === neWant && ne.why.length === (ne.gc.length ? 1 : 0) + (ne.mld.length ? 1 : 0) + (ne.xt.length >= 4 ? 1 : 0) && !ne.mld.length, `${label}: 2J-1 Krenko without either (no Blood Moon, combos set aside): the minimum follows the evidence left (Game Changers ${ne.gc.length}, mass land denial ${ne.mld.length}, extra turns ${ne.xt.length}) → ${ne.b}${ne.why.length ? ": " + ne.why.join("; ") : ", nothing left that limits it"}`);
    ok(Object.keys(want).every(id => !/because of[^.]*tutor/i.test(D[id]) && /Your judgment:/.test(D[id])), `${label}: 2J-1 no deck's bracket comes from tutors, and every box leaves intent, early combos and game length to the player`);
    ok(!D.errs.length, `${label}: 2J-1 no console errors ${JSON.stringify(D.errs)}`);
  }
})();
