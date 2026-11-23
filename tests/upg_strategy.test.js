// Stage 2J-4: strategy-aware swap suggestions on the Upgrade tab. The decks are the eleven real decks in real_decks_fixture.js (read
// only), with Scryfall's Oracle text; the candidate cards below are real cards with their real Oracle text. Every EDHREC figure in
// this file is SYNTHETIC (made up for the test, never shown as real data): the swap scoring needs inclusion and synergy numbers to
// rank anything, so each scenario sets them on purpose, and the deck's other cards get the same neutral figures (50%, +10%).
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const FIX = require("./real_decks_fixture.js");
const EXTRA = [{"id":"8b33923b-1b79-43ab-9a9d-49c05887bce7","oracle_id":"099a5835-da6c-4e03-ad3e-aeb448897fed","name":"Owl Familiar","set":"clu","set_name":"Ravnica: Clue Edition","collector_number":"90","rarity":"common","type_line":"Creature — Bird","cmc":2.0,"mana_cost":"{1}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Flying\nWhen this creature enters, draw a card, then discard a card.","layout":"normal","keywords":["Flying"],"legalities":{"commander":"legal"}},
{"id":"fa434b41-e5f7-4989-865a-95db67b05cb1","oracle_id":"0259a9ed-0558-4183-b737-871ed5573c32","name":"Gran-Gran","set":"tla","set_name":"Avatar: The Last Airbender","collector_number":"54","rarity":"uncommon","type_line":"Legendary Creature — Human Peasant Ally","cmc":1.0,"mana_cost":"{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Whenever Gran-Gran becomes tapped, draw a card, then discard a card.\nNoncreature spells you cast cost {1} less to cast as long as there are three or more Lesson cards in your graveyard.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"1c9d2542-501d-4dfe-8642-962d0299ca45","oracle_id":"06ea02f5-f296-4334-bb6f-9cb018e1e150","name":"Thought Courier","set":"9ed","set_name":"Ninth Edition","collector_number":"104","rarity":"uncommon","type_line":"Creature — Human Wizard","cmc":2.0,"mana_cost":"{1}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"{T}: Draw a card, then discard a card.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"f6589e02-8c84-4069-88d1-ebcc8520cae1","oracle_id":"08b13e1f-27ca-40a8-b5ed-88ac933d24bf","name":"Archivist of Oghma","set":"clb","set_name":"Commander Legends: Battle for Baldur's Gate","collector_number":"4","rarity":"rare","type_line":"Creature — Halfling Cleric","cmc":2.0,"mana_cost":"{1}{W}","colors":["W"],"color_identity":["W"],"oracle_text":"Flash\nWhenever an opponent searches their library, you gain 1 life and draw a card.","layout":"normal","keywords":["Flash"],"legalities":{"commander":"legal"}},
{"id":"3620ed96-1d15-4942-b9e5-9f9a64b0cab4","oracle_id":"00bcbeb5-196a-4a54-ac8d-dec708e68d01","name":"Devoted Paladin","set":"afr","set_name":"Adventures in the Forgotten Realms","collector_number":"11","rarity":"common","type_line":"Creature — Orc Knight","cmc":5.0,"mana_cost":"{4}{W}","colors":["W"],"color_identity":["W"],"oracle_text":"Beacon of Hope — When this creature enters, creatures you control get +1/+1 and gain vigilance until end of turn.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"62534128-2a85-4a36-bc7b-e4f4c51fa1f6","oracle_id":"01e742ed-660c-43c6-b393-e589a54cbe1b","name":"Voice of the Blessed","set":"inr","set_name":"Innistrad Remastered","collector_number":"50","rarity":"rare","type_line":"Creature — Spirit Cleric","cmc":2.0,"mana_cost":"{W}{W}","colors":["W"],"color_identity":["W"],"oracle_text":"Whenever you gain life, put a +1/+1 counter on this creature.\nAs long as this creature has four or more +1/+1 counters on it, it has flying and vigilance.\nAs long as this creature has ten or more +1/+1 counters on it, it has indestructible.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"dc69f960-68ba-4315-8146-6a7a82047503","oracle_id":"02090581-61aa-4348-ad57-451be8ee91c2","name":"Ponder","set":"tdc","set_name":"Tarkir: Dragonstorm Commander","collector_number":"159","rarity":"common","type_line":"Sorcery","cmc":1.0,"mana_cost":"{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Look at the top three cards of your library, then put them back in any order. You may shuffle.\nDraw a card.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"eb654a76-62ee-4fd8-83d4-cb912211a9a0","oracle_id":"3f3b2c10-21f8-4e13-be83-4ef3fa36e123","name":"Elvish Mystic","set":"soc","set_name":"Secrets of Strixhaven Commander","collector_number":"266","rarity":"common","type_line":"Creature — Elf Druid","cmc":1.0,"mana_cost":"{G}","colors":["G"],"color_identity":["G"],"oracle_text":"{T}: Add {G}.","layout":"normal","keywords":[],"produced_mana":["G"],"legalities":{"commander":"legal"}},
{"id":"4df8aabc-7fcb-4b7b-980b-18f499e6c170","oracle_id":"2f533667-e29b-4bec-897a-e7a9eee08314","name":"Hullbreacher","set":"cmr","set_name":"Commander Legends","collector_number":"74","rarity":"rare","type_line":"Creature — Merfolk Pirate","cmc":3.0,"mana_cost":"{2}{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Flash\nIf an opponent would draw a card except the first one they draw in each of their draw steps, instead you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")","layout":"normal","keywords":["Treasure","Flash"],"produced_mana":["B","G","R","U","W"],"legalities":{"commander":"banned"}},
{"id":"6e0958a1-1bac-48be-888d-f7573f409a9b","oracle_id":"38347ab3-ae43-4d10-b665-8520ace0eb76","name":"The Filigree Sylex","set":"one","set_name":"Phyrexia: All Will Be One","collector_number":"227","rarity":"rare","type_line":"Legendary Artifact","cmc":2.0,"mana_cost":"{2}","colors":[],"color_identity":[],"oracle_text":"{T}: Put an oil counter on The Filigree Sylex.\n{T}, Sacrifice The Filigree Sylex: Destroy each nonland permanent with mana value equal to the number of oil counters on The Filigree Sylex.\n{T}, Remove ten oil counters from among permanents you control and sacrifice The Filigree Sylex: It deals 10 damage to any target.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"ccda5bda-5afd-4548-bd48-12c780bfa68b","oracle_id":"06692cd9-ac2f-4a32-8fd1-043ba3c0fe71","name":"Rapid Hybridization","set":"soc","set_name":"Secrets of Strixhaven Commander","collector_number":"198","rarity":"uncommon","type_line":"Instant","cmc":1.0,"mana_cost":"{U}","colors":["U"],"color_identity":["U"],"oracle_text":"Destroy target creature. It can't be regenerated. That creature's controller creates a 3/3 green Frog Lizard creature token.","layout":"normal","keywords":[],"legalities":{"commander":"legal"}},
{"id":"aa686c34-1c11-469f-93c2-f9891aea521f","oracle_id":"002965be-a36f-4a09-9ce0-c6535bca1703","name":"Veil of Summer","set":"m20","set_name":"Core Set 2020","collector_number":"198","rarity":"uncommon","type_line":"Instant","cmc":1.0,"mana_cost":"{G}","colors":["G"],"color_identity":["G"],"oracle_text":"Draw a card if an opponent has cast a blue or black spell this turn. Spells you control can't be countered this turn. You and permanents you control gain hexproof from blue and from black until end of turn. (You and they can't be the targets of blue or black spells or abilities your opponents control.)","layout":"normal","keywords":[],"legalities":{"commander":"legal"}}];
const CARDS = Object.assign({}, FIX.cards, Object.fromEntries(EXTRA.map(c => [c.name, c])));
const BYNAME = Object.assign({}, CARDS); for (const n in CARDS) if (n.includes(" // ")) BYNAME[n.split(" // ")[0]] = CARDS[n];      // Scryfall finds a two-faced card by its front name too
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const r3 = x => Math.round(x * 1000) / 1000, near = (a, b) => Math.abs(a - b) < 1e-9;
let HIDE = new Set(), EDH = null, SEARCH = null;        // per scenario: names Scryfall "can't find", a synthetic EDHREC page, a Scryfall search result

async function page(b, opts) {
  const p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|bad HTTP response code/.test(m.text())) errs.push(m.text()); });
  const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, J = (r, j) => r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify(j) });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url());
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers; return J(r, { data: ids.map(i => !HIDE.has(i.name) && BYNAME[i.name]).filter(Boolean), not_found: [] }); }
    if (u.includes("/cards/search") && SEARCH) return J(r, { data: SEARCH.map(n => CARDS[n]), has_more: false });
    return r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.route("https://json.edhrec.com/**", r => { const path = new URL(r.request().url()).pathname.replace(/^\/pages\//, "").replace(/\.json$/, "");
    return EDH && EDH[path] ? J(r, EDH[path]) : r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall|edhrec/.test(u.hostname), r => r.fulfill({ status: 404, headers: H, body: "{}" }));
  await p.goto("http://127.0.0.1:8921/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(({ CARDS, DECKS }) => { window.__C = CARDS; window.__D = DECKS;
    window.__mk = id => { const d = { id, name: id, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
      for (const [n, q] of __D[id]) addToDeck(d, slim(__C[n]), q, false, true); d.cmdr = [__C[__D[id][0][0]].id + "|0"]; return d; };
    // U as upgradeData() builds it; stat rows are [name, decks out of 1000, synergy], all synthetic
    window.__U = (d, o = {}) => ({ cmd: deckCommanderName(d), theme: null, ci: deckCI(d), stat: new Map((o.stat || []).map(([n, num, syn]) => [n, { name: n, num, pot: 1000, syn }])),
      tstat: new Map(), meta: new Map((o.meta || []).map(n => [n, slim(__C[n])])), names: [], src: o.src || "EDHREC", key: "t" });
    window.__neutral = (d, ...over) => { const m = new Map(Object.values(d.cards).map(c => [c.name, [c.name, 500, 0.1]])); for (const x of over) if (x[1] == null) m.delete(x[0]); else m.set(x[0], x); return [...m.values()]; };
    window.__fresh = () => { OPT.text.clear(); OPT.failed.clear(); };
    window.__sw = A => A.swaps.map(s => ({ cut: s.cut.card.name, best: s.best.card.name, noCre: s.noCre, opts: [s.best, ...s.alts].map(o => ({ n: o.card.name, fit: o.fit, gain: o.gain, rank: o.rank, share: o.share, sy: o.sy ? o.sy.map(e => e.cat + "/" + e.side) : null, lost: o.lost, cre: o.roles.includes("Creature") })),
      cutFit: s.cut.fit, why: s.cut.why, isCre: s.cut.roles.includes("Creature") }));
  }, { CARDS, DECKS: FIX.decks });
  return { p, errs };
}
// the rank the code should give: gain, the existing same-job bonus, then +0.15 once for a counted strategy and −0.15 per short role lost
const want = (o, isCre) => o.gain + (o.share.length ? 0.15 : isCre && o.cre ? 0.05 : 0) + (o.sy ? 0.15 : 0) - 0.15 * o.lost.length;

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8921", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch();
  try {
    const { p, errs } = await page(b, { viewport: { width: 1280, height: 900 } });
    const BR = "Brago, King Eternal";

    // 1. cut protection without EDHREC: every one of the eleven decks, as the app does when EDHREC can't be loaded
    const P = await p.evaluate(async ids => { const out = {};
      for (const id of ids) { __fresh(); const d = __mk(id), U = __U(d, { src: "Scryfall" }), SC = await upgStrategy(d, U);
        out[id] = { before: analyzeDeck(d, U).cuts.map(c => c.card.name), after: analyzeDeck(d, U, SC).cuts.map(c => c.card.name), strat: [...SC.deck.keys()], off: SC.off, miss: SC.missDeck }; }
      return out; }, Object.keys(FIX.decks));
    for (const [id, n] of [["brago", "Agent of Treachery"], ["tatyova", "Ancient Greenwarden"], ["meren", "Butcher of Malakir"], ["mizzix", "Treasure Cruise"]])
      ok(P[id].before.includes(n) && !P[id].after.includes(n) && P[id].strat.includes(n), `${id}: ${n} was a cut on cost and roles above range alone (${P[id].before.join(", ")}); now it is protected as a strategy card`);
    ok(Object.values(P).every(x => !x.after.some(n => x.strat.includes(n))), "without EDHREC data, no detected strategy card is a cut in any of the eleven decks");
    ok(Object.values(P).every(x => !x.off && x.miss === 0), "every deck's rules text loaded (nothing was skipped)");

    // 2. EDHREC evidence (synthetic figures): under 10% or negative synergy can still make a strategy card a cut; absence alone can't
    const E = await p.evaluate(async BR => { __fresh(); const d = __mk("brago"), r = {};
      const run = stat => { const U = __U(d, { stat }); return upgStrategy(d, U).then(SC => ({ old: analyzeDeck(d, U).cuts, now: analyzeDeck(d, U, SC).cuts })); };
      const pick = (l, n) => { const c = l.find(c => c.card.name === n); return c ? c.why : null; };
      let x = await run(__neutral(d, ["Agent of Treachery", 50, 0.1])); r.low = pick(x.now, "Agent of Treachery");
      x = await run(__neutral(d, ["Agent of Treachery", 500, -0.05])); r.neg = pick(x.now, "Agent of Treachery");
      x = await run(__neutral(d, ["Agent of Treachery", null], ["Strionic Resonator", null])); r.absOld = pick(x.old, "Agent of Treachery"); r.absNow = pick(x.now, "Agent of Treachery"); r.resNow = pick(x.now, "Strionic Resonator");
      x = await run(__neutral(d, ["Agent of Treachery", 500, 0.1])); r.fine = pick(x.now, "Agent of Treachery");
      x = await run(__neutral(d, ["Panharmonicon", 50, 0.1])); r.panOld = pick(x.old, "Panharmonicon"); r.panNow = pick(x.now, "Panharmonicon");
      return r; }, BR);
    const SUP = "It supports your Blink strategy (payoff), and is suggested only because of the EDHREC figures above";
    ok(E.low && E.low.includes(`Only in 5% of ${BR} decks`) && E.low.includes(SUP), "a strategy card in under 10% of the commander's decks can still be a cut, naming its strategy and the evidence: " + JSON.stringify(E.low));
    ok(E.neg && E.neg.includes(`Below-average fit with ${BR} (synergy -5%)`) && E.neg.includes(SUP), "a strategy card with negative synergy can still be a cut: " + JSON.stringify(E.neg));
    ok(E.absOld && E.absOld.includes(`Not among the cards EDHREC lists for ${BR}`) && !E.absNow, "not being on the commander's EDHREC list doesn't count as evidence (it was a cut for that alone before)");
    ok(E.resNow && E.resNow.includes(`Not among the cards EDHREC lists for ${BR}`), "a card no strategy uses is still a cut for not being on the list (Strionic Resonator), as before");
    ok(!E.fine, "with ordinary figures (50%, +10%), the strategy card isn't a cut");
    ok(E.panOld && E.panOld.some(w => /No clear job/.test(w)) && E.panNow && !E.panNow.some(w => /No clear job/.test(w)) && E.panNow.some(w => /It supports your Blink strategy \(amplifier\)/.test(w)),
      "Panharmonicon, a Blink amplifier, is no longer called 'No clear job' (it was before): " + JSON.stringify(E.panNow));

    // 3. ranking: the same synthetic figures for each candidate, so only the strategy bonus separates them
    const CUT = ["Dour Port-Mage", 50, -0.1], CAND = ["Owl Familiar", "Gran-Gran", "Thought Courier", "Archivist of Oghma"];
    HIDE = new Set(["Archivist of Oghma"]);                 // Scryfall "can't find" its text: it must get no bonus
    const R = await p.evaluate(async ([CUT, CAND]) => { __fresh(); const d = __mk("brago"), U = __U(d, { meta: CAND, stat: [...__neutral(d, CUT), ...CAND.map(n => [n, 800, 0.8])] });
      const SC = await upgStrategy(d, U), A = analyzeDeck(d, U, SC), A0 = analyzeDeck(d, U);
      return { sw: __sw(A), sw0: __sw(A0), cand: Object.fromEntries(CAND.map(n => [n, SC.cand.has(n) ? SC.cand.get(n).map(e => e.cat + "/" + e.side) : null])), missCand: SC.missCand,
        voice: (() => { const T = { text: __C["Voice of the Blessed"].oracle_text, type: __C["Voice of the Blessed"].type_line, kw: [], mana: [] }; return optSynergy(T, slim(__C["Voice of the Blessed"]), [...SC.counted], "").filter(e => e.direct && !e.potential && (e.side === "enabler" || e.side === "payoff")).map(e => e.cat + "/" + e.side); })(),
        counted: [...SC.counted] }; }, [CUT, CAND]);
    HIDE = new Set();
    const s = R.sw.find(x => x.cut === "Dour Port-Mage"), s0 = R.sw0.find(x => x.cut === "Dour Port-Mage"), o = n => s && s.opts.find(x => x.n === n);
    ok(s && CAND.every(n => o(n)) && CAND.every(n => near(o(n).fit, o("Thought Courier").fit)), "Dour Port-Mage's four options have the same fit: " + (s ? s.opts.map(x => `${x.n} ${r3(x.fit)}`).join(", ") : "no swap"));
    ok(s && ["Owl Familiar", "Gran-Gran"].includes(s.best) && near(o("Owl Familiar").rank - o("Thought Courier").rank, 0.15), `with everything else equal, a card a counted strategy uses ranks first (${s && s.best}), by exactly 0.15`);
    ok(s && R.cand["Gran-Gran"].length >= 2 && near(o("Gran-Gran").rank, o("Owl Familiar").rank), `Gran-Gran supports two counted strategies (${R.cand["Gran-Gran"].join(", ")}) and gets the bonus once: the same rank as Owl Familiar (one strategy)`);
    ok(R.cand["Archivist of Oghma"] === null && R.missCand === 1 && s && !o("Archivist of Oghma").sy && near(o("Archivist of Oghma").rank, o("Thought Courier").rank), "a candidate whose rules text didn't load gets no bonus, and is counted as not checked");
    ok(R.voice.length && R.voice.every(e => /^lifegain\//.test(e)) && !R.counted.includes("lifegain"), `Voice of the Blessed's only strategy is Lifegain (${R.voice.join(", ")}), which isn't counted in Brago's deck (${R.counted.join(", ")})…`);
    ok(s && s.opts.every(x => near(x.rank, want(x, s.isCre))), "every option's rank is exactly gain + same-job bonus + 0.15 for a counted strategy − 0.15 per short role lost");
    ok(s && s0 && s.opts.every(x => { const y = s0.opts.find(z => z.n === x.n); return y && near(y.fit, x.fit) && near(y.gain, x.gain); }), "fit and gain are the same as without the strategy check (rank alone changes)");
    // …so Voice of the Blessed, as an option, gets no bonus (it qualifies as an option for a card with no job, such as Strionic Resonator)
    const PD = await p.evaluate(async () => { __fresh(); const d = __mk("brago"), U = __U(d, { meta: ["Voice of the Blessed", "Owl Familiar"], stat: [...__neutral(d, ["Strionic Resonator", 50, -0.1]), ["Voice of the Blessed", 800, 0.8], ["Owl Familiar", 800, 0.8]] });
      const SC = await upgStrategy(d, U); return __sw(analyzeDeck(d, U, SC)).find(x => x.cut === "Strionic Resonator"); });
    const pd = PD && PD.opts.find(x => x.n === "Voice of the Blessed"), pw = PD && PD.opts.find(x => x.n === "Owl Familiar");
    ok(pd && pw && pd.sy === null && pw.sy && near(pd.rank, want(pd, PD.isCre)) && near(pd.fit, pw.fit) && near(pw.rank - pd.rank, 0.15), "…and as an option it gets no bonus for that uncounted strategy (Owl Familiar, with the same fit, gets 0.15)");

    // 4. short-role penalty (Tatyova is short on card draw, removal, board wipes and protection)
    const T = await p.evaluate(async () => { const out = {};
      for (const [cut, meta] of [["Cyclonic Rift", ["The Filigree Sylex", "Rapid Hybridization", "Veil of Summer"]], ["Sol Ring", ["Rapid Hybridization"]]]) {
        __fresh(); const d = __mk("tatyova"), U = __U(d, { meta, stat: [...__neutral(d, [cut, 50, -0.1]), ...meta.map(n => [n, 800, 0.8])] }), SC = await upgStrategy(d, U);
        out[cut] = { sw: __sw(analyzeDeck(d, U, SC)).find(x => x.cut === cut), sw0: __sw(analyzeDeck(d, U)).find(x => x.cut === cut), low: deckGaps(d).low, rift: rolesOf(Object.values(d.cards).find(c => c.name === cut)) }; }
      return out; });
    const rf = T["Cyclonic Rift"], ro = n => rf.sw && rf.sw.opts.find(x => x.n === n);
    ok(rf.rift.includes("Removal") && rf.rift.includes("Board wipe") && rf.low.includes("Removal") && rf.low.includes("Board wipe"), "Cyclonic Rift has removal and a board wipe, and Tatyova's deck is short on both");
    ok(ro("The Filigree Sylex") && ro("The Filigree Sylex").lost.length === 0, "The Filigree Sylex keeps both roles: no penalty");
    ok(ro("Rapid Hybridization") && ro("Rapid Hybridization").lost.join() === "Board wipe" && near(ro("Rapid Hybridization").rank, want(ro("Rapid Hybridization"), false)), "Rapid Hybridization keeps removal but not the board wipe: −0.15");
    ok(ro("Veil of Summer") && ro("Veil of Summer").lost.join() === "Removal,Board wipe" && near(ro("Veil of Summer").rank, want(ro("Veil of Summer"), false)), "Veil of Summer keeps neither: −0.30");
    ok(rf.sw && near(ro("The Filigree Sylex").rank - ro("Rapid Hybridization").rank, 0.15) && rf.sw.best === "The Filigree Sylex", "with equal fit, the option that keeps both short roles ranks first, 0.15 ahead of the one that keeps one");
    ok(rf.sw && rf.sw0 && rf.sw.opts.every(x => { const y = rf.sw0.opts.find(z => z.n === x.n); return y && near(y.fit, x.fit) && near(y.gain, x.gain); }), "fit and gain unchanged by the penalty");
    const sr = T["Sol Ring"], so = sr.sw && sr.sw.opts.find(x => x.n === "Rapid Hybridization");
    ok(!sr.low.includes("Ramp") && so && so.lost.length === 0, "Sol Ring's ramp isn't short in Tatyova's deck (it is above range), so replacing it with removal has no penalty");

    // 5. creature for creature, when one passes the same checks
    const CR = await p.evaluate(async () => { const out = {};
      for (const [k, meta] of [["both", ["Ponder", "Thought Courier"]], ["only", ["Ponder"]]]) { __fresh();
        const d = __mk("brago"), U = __U(d, { meta, stat: [...__neutral(d, ["Dour Port-Mage", 50, -0.1]), ["Ponder", 950, 0.95], ["Thought Courier", 700, 0.7]] }), SC = await upgStrategy(d, U);
        const A = analyzeDeck(d, U, SC), s = A.swaps.find(x => x.cut.card.name === "Dour Port-Mage");
        out[k] = { sw: __sw(A).find(x => x.cut === "Dour Port-Mage"), old: __sw(analyzeDeck(d, U)).find(x => x.cut === "Dour Port-Mage"),
          exBest: s && upgExplain(Object.assign({ gaps: A.gaps.low }, s), U), exAlts: s && s.alts.map(a => ({ n: a.card.name, ex: upgExplain({ cut: s.cut, best: a, gaps: A.gaps.low }, U) })) }; }
      return out; });
    const both = CR.both, po = both.sw && both.sw.opts.find(x => x.n === "Ponder"), tco = both.sw && both.sw.opts.find(x => x.n === "Thought Courier");
    ok(po && tco && !tco.sy && po.rank > tco.rank && both.sw.best === "Thought Courier", `Dour Port-Mage (a creature): Thought Courier (no strategy bonus) is the choice over the higher-ranked Ponder (${po && r3(po.rank)} vs ${tco && r3(tco.rank)})`);
    const pa = both.exAlts && both.exAlts.find(x => x.n === "Ponder");
    ok(pa && pa.ex.minus.includes("This alternative reduces your creature count by one"), "Ponder stays as another option, marked: This alternative reduces your creature count by one");
    ok(both.exBest && !both.exBest.minus.some(m => /creature count/.test(m)), "the creature replacement itself has no creature-count line");
    ok(CR.only.sw && CR.only.sw.best === "Ponder" && CR.only.sw.noCre && CR.only.exBest.minus.includes("Reduces your creature count by one: no creature replacement fits"), "with no creature that fits, Ponder is the choice, with the warning");

    // 6. text that didn't load
    const M = await p.evaluate(async () => { const out = {};
      __fresh(); let d = __mk("brago"), U = __U(d, { src: "Scryfall" }); const before = JSON.stringify(d), roles0 = JSON.stringify(S.roles || null);
      let SC = await upgStrategy(d, U); const A = analyzeDeck(d, U, SC); out.unchanged = JSON.stringify(d) === before && JSON.stringify(S.roles || null) === roles0;
      return out; });
    ok(M.unchanged, "reading the strategy changes nothing in the saved deck (or the saved role fixes)");
    HIDE = new Set(["Agent of Treachery"]);
    const M1 = await p.evaluate(async () => { __fresh(); const d = __mk("brago"), U = __U(d, { src: "Scryfall" }), SC = await upgStrategy(d, U);
      return { miss: SC.missDeck, off: SC.off, cuts: analyzeDeck(d, U, SC).cuts.map(c => c.card.name), old: analyzeDeck(d, U).cuts.map(c => c.card.name) }; });
    ok(M1.miss === 1 && !M1.off && M1.cuts.includes("Agent of Treachery") && JSON.stringify(M1.cuts) === JSON.stringify(M1.old), "one deck card's text missing (Agent of Treachery): that card is judged as before (a cut again), and counted as not checked");
    HIDE = new Set(FIX.decks.brago.map(x => x[0]).concat(EXTRA.map(c => c.name)));
    const M2 = await p.evaluate(async () => { __fresh(); const d = __mk("brago"), U = __U(d, { meta: ["Ponder", "Thought Courier", "Owl Familiar"], stat: [...__neutral(d, ["Dour Port-Mage", 50, -0.1], ["Agent of Treachery", null]), ["Ponder", 950, 0.95], ["Thought Courier", 700, 0.7], ["Owl Familiar", 700, 0.7]] });
      const SC = await upgStrategy(d, U), j = A => JSON.stringify({ cuts: A.cuts.map(c => [c.card.name, c.score, c.why]), sw: __sw(A) });
      return { off: SC.off, miss: SC.missDeck, same: j(analyzeDeck(d, U, SC)) === j(analyzeDeck(d, U)) }; });
    HIDE = new Set();
    ok(M2.off && M2.miss > 50 && M2.same, `none of the deck's text loaded (${M2.miss} cards): no strategy is counted and the cuts and swaps are exactly as before the change`);
    ok(!errs.length, "no errors" + (errs.length ? ": " + errs[0] : ""));
    await p.context().close();

    // 7. the Upgrade tab itself, at computer and phone width, through upgradeData() with a synthetic EDHREC page. It is opened the way
    //    a person does (the deck, then its Upgrade tab): opening a deck straight on that tab before its EDHREC data is loaded can draw
    //    twice and throw (an error that predates Stage 2J-4, reported separately and not changed here)
    const view = { cardlists: [{ header: "Top Cards", tag: "topcards", cardviews: [] }] }, cv = (n, num, syn) => ({ name: n, num_decks: num, potential_decks: 1000, synergy: syn });
    for (const [n] of FIX.decks.brago.slice(1)) if (!["Dour Port-Mage", "Agent of Treachery"].includes(n)) view.cardlists[0].cardviews.push(cv(n, 500, 0.1));
    view.cardlists[0].cardviews.push(cv("Dour Port-Mage", 50, -0.1), cv("Agent of Treachery", 500, 0.1), cv("Owl Familiar", 700, 0.7), cv("Thought Courier", 700, 0.7), cv("Ponder", 950, 0.95), cv("Elvish Mystic", 990, 0.99), cv("Hullbreacher", 990, 0.99));
    const EDHPAGE = { "commanders/brago-king-eternal": { panels: { taglinks: [] }, container: { json_dict: view } } };
    for (const [opts, label] of [[{ viewport: { width: 1280, height: 900 } }, "computer"], [{ ...devices["Pixel 7"] }, "phone"]]) {
      EDH = EDHPAGE; SEARCH = null; HIDE = new Set();
      const { p, errs } = await page(b, opts);
      const open = async () => { await p.evaluate(() => { const d = __mk("brago"); S.decks.brago = d; save(); deckTab.brago = "cards"; go("decks", "brago"); }); await p.waitForSelector('#dTabs [data-t="upgrade"]'); await p.waitForTimeout(300);
        await p.click('#dTabs [data-t="upgrade"]'); await p.waitForSelector(".swap, #dPane .box", { timeout: 20000 }); await p.waitForFunction(() => !document.querySelector("#uPending"), null, { timeout: 20000 }); await p.waitForTimeout(600);
        return p.evaluate(() => ({ text: document.querySelector("#dPane").textContent.replace(/\s+/g, " "), swaps: [...document.querySelectorAll(".swap")].map(s => ({ pair: [...s.querySelectorAll(".sc b")].map(x => x.textContent).join(" → "), text: s.textContent.replace(/\s+/g, " ") })),
          strat: (document.querySelector("#uStrat") || {}).textContent || "", source: (document.querySelector("#uSource") || {}).textContent || "", over: document.documentElement.scrollWidth > innerWidth + 1 })); };
      let v = await open(); const pm = v.swaps.find(x => /^Dour Port-Mage →/.test(x.pair));
      ok(pm && pm.pair === "Dour Port-Mage → Owl Familiar" && /\+ Supports your Blink strategy \(payoff\)/.test(pm.text), `${label}: Dour Port-Mage → Owl Familiar, "Supports your Blink strategy (payoff)"` + (pm ? "" : ` — got ${JSON.stringify(v.swaps.map(x => x.pair))}`));
      ok(!v.swaps.some(x => /Elvish Mystic|Hullbreacher/.test(x.text)), `${label}: the off-color (Elvish Mystic) and banned (Hullbreacher) cards are never suggested, though they have the highest figures`);
      ok(!v.swaps.some(x => /^Agent of Treachery →/.test(x.pair)), `${label}: Agent of Treachery isn't offered as a cut`);
      ok(!v.strat && !v.source, `${label}: no status lines when everything loaded and EDHREC is the source`);
      // the comparison sheet shows the other options, the noncreature one marked
      const i = await p.evaluate(() => { const s = [...document.querySelectorAll(".swap")].find(s => /^Dour Port-Mage/.test(s.querySelector(".sc b").textContent)); return s && s.querySelector("[data-scmp]").dataset.scmp; });
      await p.click(`[data-scmp="${i}"]`); await p.waitForTimeout(300);
      const sheet = await p.evaluate(() => document.querySelector("#sheetRoot").textContent.replace(/\s+/g, " "));
      ok(/Ponder.*This alternative reduces your creature count by one/.test(sheet), `${label}: in Compare, Ponder is marked "This alternative reduces your creature count by one"`);
      await p.evaluate(() => closeSheet()); await p.waitForTimeout(150);
      ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await p.context().close();
    }
    for (const [opts, label] of [[{ viewport: { width: 1280, height: 900 } }, "computer"], [{ ...devices["Pixel 7"] }, "phone"]]) {
      // no EDHREC (a fresh page, so nothing is cached): suggestions from Scryfall's popular cards, said so; one deck card's text missing, said so
      EDH = null; SEARCH = ["Thought Courier", "Ponder", "Owl Familiar", "Rapid Hybridization"]; HIDE = new Set(["Agent of Treachery"]);
      const { p, errs } = await page(b, opts);
      const open = async () => { await p.evaluate(() => { const d = __mk("brago"); S.decks.brago = d; save(); deckTab.brago = "cards"; go("decks", "brago"); }); await p.waitForSelector('#dTabs [data-t="upgrade"]'); await p.waitForTimeout(300);
        await p.click('#dTabs [data-t="upgrade"]'); await p.waitForSelector(".swap, #dPane .box", { timeout: 20000 }); await p.waitForFunction(() => !document.querySelector("#uPending"), null, { timeout: 20000 }); await p.waitForTimeout(600);
        return p.evaluate(() => ({ text: document.querySelector("#dPane").textContent.replace(/\s+/g, " "), swaps: [...document.querySelectorAll(".swap")].map(s => ({ pair: [...s.querySelectorAll(".sc b")].map(x => x.textContent).join(" → "), text: s.textContent.replace(/\s+/g, " ") })),
          strat: (document.querySelector("#uStrat") || {}).textContent || "", source: (document.querySelector("#uSource") || {}).textContent || "", over: document.documentElement.scrollWidth > innerWidth + 1 })); };
      let v = await open();
      ok(v.source === "Suggested from cards popular in these colors, not with this commander.", `${label}: without EDHREC: "${v.source}"`);
      ok(v.strat === "Strategy wasn't checked for 1 card (1 in this deck, 0 suggested): its rules text couldn't be loaded from Scryfall, so it is judged without its strategy.", `${label}: the status line: "${v.strat}"`);
      ok(v.swaps.length && !v.swaps.some(x => /Better fit with|synergy|of Brago, King Eternal decks/.test(x.text)), `${label}: no commander-specific claim in any swap without EDHREC (${v.swaps.map(x => x.pair).join(" | ")})`);
      HIDE = new Set(FIX.decks.brago.map(x => x[0]).concat(EXTRA.map(c => c.name)));
      await p.evaluate(() => { __fresh(); upgState.brago = null; }); v = await open();
      ok(/^Strategy couldn't be checked: the rules text of \d+ cards in this deck couldn't be loaded from Scryfall, so these suggestions don't take the deck's strategies into account\.$/.test(v.strat), `${label}: none of the deck's text: "${v.strat}"`);
      ok(!v.over, `${label}: nothing runs off the side of the screen`);
      ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : ""));
      HIDE = new Set(); EDH = null; SEARCH = null; await p.context().close();
    }
  } finally { await b.close(); srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
