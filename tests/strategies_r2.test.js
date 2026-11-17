// Strategies, Stage 1 corrections from the round-2 real-deck audit: real Commander decklists with real Oracle text.
// MOCKED: Scryfall and EDHREC are pretend (routes below). The card data is real: real_decks_fixture.js holds Scryfall's Oracle text
// (Scryfall's "Oracle cards" bulk data, sets through 2026-11-20) for every card in eleven EDHREC average decks (each a full
// 100-card list that EDHREC builds from many players' decks): Krenko, Mizzix and Shorikai (round 1) and Teysa Karlov, Meren,
// Atraxa, Sythis, Tatyova, Wyleth, Brago and Lathril (round 2).
// Checks: H1 graveyard triggers that aren't deaths, H2 counter amplifiers, H3 trigger multipliers, H4 graveyard setup and
// reanimation, H5 the theme line's count of the deck's own cards; and that Krenko, Mizzix and Shorikai give exactly what they
// gave before (real_decks_fixture.js "before", recorded at commit 23365e10). At computer and phone widths.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const FIX = require("./real_decks_fixture.js");
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8962", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch();
  try {
    for (const [label, opts] of [["computer", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
      const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
      const byName = {}; for (const n in FIX.cards) { byName[n] = FIX.cards[n]; byName[FIX.cards[n].name] = FIX.cards[n]; byName[FIX.cards[n].name.split(" // ")[0]] = byName[FIX.cards[n].name.split(" // ")[0]] || FIX.cards[n]; }   // the app asks for a two-faced card by its front name
      await p.route("https://api.scryfall.com/**", r => { const u = r.request().url();
        if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers;
          return r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ data: ids.map(i => byName[i.name] || Object.values(FIX.cards).find(c => c.id === i.id)).filter(Boolean), not_found: [] }) }); }
        return r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }); });
      await p.route(u => /^https:/.test(u.href) && !/api\.scryfall/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
      await p.goto("http://127.0.0.1:8962/app_real.html"); await p.waitForTimeout(500);
      const THEME = { krenko: "Goblins", mizzix: "Spellslinger", shorikai: "Vehicles", teysa: "Aristocrats", meren: "Reanimator", atraxa: "Counters (+1/+1)", sythis: "Enchantments", tatyova: "Landfall", wyleth: "Equipment", brago: "Blink", lathril: "Elves" };
      // a deck (commander first) analysed: each card's strategy entries and the deck's sums
      const run = (id, list, theme) => p.evaluate(async ({ id, list, cards, theme }) => {
        const d = { id, name: id, format: "commander", cmdr: [], cards: {}, themes: theme ? [theme] : [], created: 1, updated: 1 }; S.decks[id] = d;
        const [cmd, ...rest] = list; addToDeck(d, cards[cmd[0]], 1, false, true); d.cmdr = Object.keys(d.cards);
        for (const [n, q] of rest) addToDeck(d, cards[n], q, false, true);
        await optTexts(list.map(x => cards[x[0]].name));
        const A = optAnalyze(d, { cmd: "", theme: "", R: null, stat: new Map(), tstat: new Map() }, { combos: null });
        const e2s = e => `${e.cat}/${e.side}${e.direct ? "" : "/incidental"}${e.active ? "" : "/notcounted"}`;
        const sy = {}, why = {}, roles = {}; for (const r of A.rows) { sy[r.name] = r.sy.map(e2s); why[r.name] = r.sy.map(e => `${e.cat}/${e.side}: ${e.why} · ${e.quote}`); roles[r.name] = r.roles.join(","); }
        return { sy, why, roles, weak: A.weak.map(w => `${w.title}: ${w.counts}`), notes: A.notes.map(w => `${w.title}: ${w.counts}`), healthy: A.healthy.map(h => `${h.role} ${h.v}`),
          cats: A.strat.cats.map(g => `${g.label}: ${g.cards.length} cards/${g.copies} copies · en ${g.en.length} · pay ${g.pay.length}${g.amp.length ? " · amp " + g.amp.length : ""}${g.fod.length ? " · fodder " + g.fod.length : ""}${g.pot.length ? " · potential " + new Set(g.pot.map(x => x.r)).size : ""}${g.inc.length ? " · incidental " + new Set(g.inc.map(x => x.r)).size : ""}`),
          cmd: A.strat.cmd.map(x => x.e.cat + "/" + x.e.side), multi: A.strat.multi.map(r => r.name), imbKeys: A.strat.imb.map(o => o.key), imbText: A.strat.imb.map(o => o.text),
          imb: A.strat.imb.map(o => `[${o.key}] ${o.text} || ` + o.sides.map(s => `${s.name}: ${s.l.map(y => y.r.name).join(", ")}`).join(" | ")), unknown: A.unknown.map(r => r.name) };
      }, { id, list, cards: FIX.cards, theme });
      const R = {}; for (const id in FIX.decks) R[id] = await run(id, FIX.decks[id], THEME[id]);
      const has = (id, n, x) => (R[id].sy[n] || []).includes(x), any = (id, n, pre) => (R[id].sy[n] || []).some(s => s.startsWith(pre));
      let k = 0; const mini = (cmd, names, theme) => run("mini" + (++k), [[cmd, 1], ...names.map(n => [n, 1])], theme);

      // ---- H1: a noncreature permanent going to the graveyard isn't a death
      for (const [id, n] of [["sythis", "Rancor"], ["sythis", "Starfield Mystic"], ["wyleth", "Tiana, Ship's Caretaker"]]) ok(!any(id, n, "sacrifice/payoff"), `${label}: H1 ${n} (an Aura, enchantment or Equipment put into a graveyard) is not a sacrifice payoff (${R[id].sy[n]})`);
      ok(!R.sythis.imbKeys.includes("sacrifice") && !R.sythis.cats.some(c => /^Sacrifice: [1-9]/.test(c)), `${label}: H1 so Sythis gets no "sacrifice payoffs without outlets" observation (${R.sythis.imbKeys})`);
      for (const n of ["Blood Artist", "Zulaport Cutthroat", "Cruel Celebrant", "Grim Haruspex", "Midnight Reaper", "Pitiless Plunderer", "Grave Pact"]) ok(has("teysa", n, "sacrifice/payoff"), `${label}: H1 ${n} still rewards creatures dying`);
      ok(has("teysa", "Marionette Apprentice", "sacrifice/payoff"), `${label}: H1 Marionette Apprentice ("another creature or artifact … put into a graveyard from the battlefield") still counts: a creature is named`);
      ok(has("lathril", "Prowess of the Fair", "sacrifice/payoff"), `${label}: H1 Prowess of the Fair ("another nontoken Elf is put into your graveyard") still counts: Elf is a creature type in the deck`);
      ok(has("teysa", "Viscera Seer", "sacrifice/enabler") && !any("teysa", "Viscera Seer", "sacrifice/payoff") && has("teysa", "Doomed Traveler", "sacrifice/fodder") && !any("teysa", "Blood Artist", "sacrifice/enabler"), `${label}: H1 outlets, fodder and payoffs stay apart`);

      // ---- H2: counter amplifiers
      for (const [id, n] of [["atraxa", "Doubling Season"], ["atraxa", "Vorinclex, Monstrous Raider"], ["atraxa", "Deepglow Skate"], ["atraxa", "Tekuthal, Inquiry Dominus"], ["atraxa", "Innkeeper's Talent"], ["lathril", "Doubling Season"]])
        ok(has(id, n, "counters/amplifier"), `${label}: H2 ${n} makes counter makers put more counters (${R[id].sy[n]})`);
      ok(!any("atraxa", "Tekuthal, Inquiry Dominus", "counters/enabler"), `${label}: H2 Tekuthal ("If you would proliferate, proliferate twice instead") multiplies proliferate; it doesn't proliferate itself`);
      ok(!any("atraxa", "Voidwing Hybrid", "counters/enabler") && has("atraxa", "Voidwing Hybrid", "counters/payoff") && has("atraxa", "Ezuri, Stalker of Spheres", "counters/payoff") && has("atraxa", "Ezuri, Stalker of Spheres", "counters/enabler"), `${label}: H2 "When you proliferate" rewards proliferating; Ezuri both proliferates and rewards it`);
      ok(has("atraxa", "Doubling Season", "tokens/amplifier") && !any("atraxa", "Doubling Season", "counters/payoff") && !any("atraxa", "Doubling Season", "counters/enabler"), `${label}: H2 Doubling Season amplifies tokens and counters, and is neither a counter maker nor a payoff`);
      ok(!any("tatyova", "Mossborn Hydra", "counters/amplifier"), `${label}: H2 Mossborn Hydra doubles only its own counters: not an amplifier for the deck (${R.tatyova.sy["Mossborn Hydra"]})`);
      for (const n of ["Evolution Sage", "Flux Channeler", "Brokers Ascendancy", "Contagion Engine"]) ok(has("atraxa", n, "counters/enabler") && !any("atraxa", n, "counters/amplifier"), `${label}: H2 ${n} still puts counters on things and isn't an amplifier`);
      ok(!Object.values(R.meren.sy).some(l => l.some(s => s.startsWith("counters/amplifier"))) && !Object.values(R.mizzix.sy).some(l => l.some(s => s.startsWith("counters/amplifier"))), `${label}: H2 experience counters (Meren, Mizzix) make no counter amplifier`);
      ok(R.atraxa.cats.find(c => c.startsWith("Counters:")).includes("amp 5"), `${label}: H2 Atraxa's Counters counts 5 amplifiers (${R.atraxa.cats.find(c => c.startsWith("Counters:"))})`);
      ok(!R.lathril.imbKeys.includes("counters-makers"), `${label}: H2 Lathril has counter makers and Doubling Season: no "nothing makes more of them" observation (${R.lathril.imbKeys})`);
      let m = await mini("Teysa Karlov", ["Doubling Season", "Vorinclex, Monstrous Raider", "Deepglow Skate"]);
      const ct = m.imbText[m.imbKeys.indexOf("counters")] || "";
      ok(m.imbKeys.includes("counters") && !m.imbKeys.includes("counters-makers") && /^This deck has 3 cards that reward counters or make more of them, but no card that puts counters on things\.$/.test(ct), `${label}: H2 amplifiers with no counter makers at all: worth a look (${m.imbKeys}: ${ct}); Teysa and Doubling Season also give the existing tokens observation`);
      m = await mini("Teysa Karlov", ["Doubling Season", "Vorinclex, Monstrous Raider", "Evolution Sage", "Brokers Ascendancy"]);
      ok(!m.imbKeys.includes("counters") && !m.imbKeys.includes("counters-makers"), `${label}: H2 amplifiers with counter makers: nothing to say (${m.imbKeys})`);
      m = await mini("Teysa Karlov", ["Evolution Sage", "Brokers Ascendancy", "Contagion Engine"]);
      ok(m.imbKeys.join() === "counters-makers", `${label}: H2 counter makers with neither payoff nor amplifier: the existing observation is unchanged (${m.imbKeys})`);

      // ---- H3: trigger multipliers, each tied to its kind of trigger
      ok(has("teysa", "Teysa Karlov", "sacrifice/amplifier") && R.teysa.cmd.includes("sacrifice/amplifier") && has("teysa", "Drivnod, Carnage Dominus", "sacrifice/amplifier"), `${label}: H3 Teysa Karlov and Drivnod make death triggers happen twice (sacrifice amplifiers)`);
      ok(has("tatyova", "Ancient Greenwarden", "landfall/amplifier"), `${label}: H3 Ancient Greenwarden makes landfall triggers happen twice`);
      for (const n of ["Panharmonicon", "Elesh Norn, Mother of Machines", "Starfield Vocalist"]) ok(has("brago", n, "blink/amplifier") && !R.brago.unknown.includes(n), `${label}: H3 ${n} makes enters-the-battlefield triggers happen twice, counted in the blink deck`);
      ok(["blink", "landfall"].every(k => !any("teysa", "Teysa Karlov", k)) && ["sacrifice", "blink"].every(k => !any("tatyova", "Ancient Greenwarden", k + "/amplifier")) && ["sacrifice", "landfall"].every(k => !any("brago", "Panharmonicon", k)), `${label}: H3 each multiplier is tied only to its own trigger kind`);
      ok(!any("brago", "Strionic Resonator", "blink/amplifier") && !any("atraxa", "Ezuri, Stalker of Spheres", "blink/amplifier") && !any("teysa", "Bastion of Remembrance", "sacrifice/amplifier"), `${label}: H3 copying a trigger (Strionic Resonator) or having one isn't multiplying triggers`);
      m = await mini("Krenko, Mob Boss", ["Teysa Karlov", "Ancient Greenwarden", "Panharmonicon", "Lightning Bolt"].filter(n => FIX.cards[n]));
      ok(!m.sy["Teysa Karlov"].some(s => /amplifier/.test(s)) && !m.sy["Ancient Greenwarden"].some(s => /amplifier/.test(s)) && !m.sy["Panharmonicon"].some(s => /amplifier/.test(s)), `${label}: H3 with no death, landfall or enters triggers in the deck, the multipliers support nothing (${m.sy["Teysa Karlov"]} | ${m.sy["Ancient Greenwarden"]} | ${m.sy["Panharmonicon"]})`);
      m = await mini("Krenko, Mob Boss", ["Panharmonicon", "Mulldrifter", "Wall of Omens"]);
      ok(m.sy["Panharmonicon"].includes("blink/amplifier/notcounted"), `${label}: H3 with enters abilities but no blink card, Panharmonicon is a potential amplifier, not counted (as enters abilities are) (${m.sy["Panharmonicon"]})`);
      m = await mini("Krenko, Mob Boss", ["Ancient Greenwarden", "Lotus Cobra"]);
      ok(m.sy["Ancient Greenwarden"].includes("landfall/amplifier"), `${label}: H3 with a landfall payoff, Ancient Greenwarden counts (${m.sy["Ancient Greenwarden"]})`);

      // ---- H3 final: "a permanent entering" (Elesh Norn, Starfield Vocalist) covers lands too, so it can amplify landfall as well as
      // enters-the-battlefield abilities, each only when the deck has those triggers; once per strategy
      const EN = "Elesh Norn, Mother of Machines", amps = (r, cat) => (r.cats.find(c => c.startsWith(cat + ":")) || "").match(/amp (\d+)/), en = r => r.sy[EN].join(",");
      m = await mini("Krenko, Mob Boss", [EN, "Mulldrifter", "Wall of Omens", "Cloudshift"]);
      ok(m.sy[EN].join() === "blink/amplifier" && !m.cats.some(c => c.startsWith("Landfall")), `${label}: H3 Elesh Norn with enters abilities (Mulldrifter, Wall of Omens) and no landfall: a Blink amplifier only (${en(m)})`);
      m = await mini("Krenko, Mob Boss", [EN, "Lotus Cobra", "Rampaging Baloths"]);
      ok(m.sy[EN].join() === "landfall/amplifier" && amps(m, "Landfall") && amps(m, "Landfall")[1] === "1", `${label}: H3 Elesh Norn with landfall (Lotus Cobra, Rampaging Baloths) and no other enters abilities: a Landfall amplifier only (${en(m)} | ${m.cats.find(c => c.startsWith("Landfall"))})`);
      m = await mini("Krenko, Mob Boss", [EN, "Mulldrifter", "Wall of Omens", "Cloudshift", "Lotus Cobra", "Rampaging Baloths"]);
      ok(m.sy[EN].join() === "landfall/amplifier,blink/amplifier" && amps(m, "Landfall")[1] === "1" && amps(m, "Blink")[1] === "1" && m.cats.find(c => c.startsWith("Landfall:")).startsWith("Landfall: 3 cards/3 copies"), `${label}: H3 Elesh Norn with both: amplifies both, counted once in each (${en(m)} | ${m.cats.filter(c => /^(Landfall|Blink)/.test(c)).join(" | ")})`);
      m = await mini("Krenko, Mob Boss", [EN, "Sol Ring", "Counterspell"]);
      ok(!m.sy[EN].length && m.unknown.includes(EN), `${label}: H3 Elesh Norn with neither: supports nothing (${en(m)})`);
      m = await mini("Krenko, Mob Boss", ["Starfield Vocalist", "Panharmonicon", "Lotus Cobra", "Rampaging Baloths"]);
      ok(m.sy["Starfield Vocalist"].join() === "landfall/amplifier" && !m.sy["Panharmonicon"].length, `${label}: H3 Starfield Vocalist has the same "a permanent entering" wording and amplifies landfall; Panharmonicon ("an artifact or creature") doesn't (${m.sy["Starfield Vocalist"]} | ${m.sy["Panharmonicon"]})`);
      m = await mini("Krenko, Mob Boss", ["Ancient Greenwarden", "Mulldrifter", "Wall of Omens", "Cloudshift"]);
      ok(!m.sy["Ancient Greenwarden"].some(s => /amplifier/.test(s)), `${label}: H3 Ancient Greenwarden ("a land entering") doesn't amplify enters abilities (${m.sy["Ancient Greenwarden"]})`);
      ok(R.brago.sy["Panharmonicon"].join() === "blink/amplifier" && R.brago.sy[EN].join() === "blink/amplifier" && R.brago.sy["Starfield Vocalist"].join() === "blink/amplifier" && amps(R.brago, "Blink")[1] === "3", `${label}: H3 Brago (enters abilities, no landfall): the three stay Blink amplifiers only`);
      ok(R.tatyova.sy["Ancient Greenwarden"].includes("landfall/amplifier") && R.teysa.sy["Teysa Karlov"].includes("sacrifice/amplifier") && R.teysa.sy["Drivnod, Carnage Dominus"].includes("sacrifice/amplifier"), `${label}: H3 Ancient Greenwarden in the landfall deck, Teysa and Drivnod in the death-trigger deck, unchanged`);

      // ---- Stage 2A: blink over two sentences, "Exile …" then "Return it/that card/those cards to the battlefield …" (at the next end step)
      const B5 = ["Eerie Interlude", "Flickerwisp", "Charming Prince", "Yorion, Sky Nomad", "Venser, the Sojourner"];
      for (const n of B5) ok(has("brago", n, "blink/enabler") && R.brago.why[n].some(w => /^blink\/enabler: Exiles and returns your permanents \(blink\) · Exile [^·]+ Return /.test(w)), `${label}: 2A ${n} exiles and returns: a blink enabler, quoting both sentences (${R.brago.why[n].filter(w => /blink\/enabler/.test(w))})`);
      ok(!R.brago.unknown.includes("Eerie Interlude"), `${label}: 2A Eerie Interlude is no longer under "No role identified"`);
      ok(["Flickerwisp", "Charming Prince", "Yorion, Sky Nomad"].every(n => has("brago", n, "blink/payoff")), `${label}: 2A Flickerwisp, Charming Prince and Yorion keep their enters-the-battlefield payoff too`);
      ok(R.brago.roles["Venser, the Sojourner"] === "Removal" && R.brago.roles["Eerie Interlude"] === "" && R.brago.roles["Flickerwisp"] === "Creature", `${label}: 2A functional roles unchanged (Venser ${R.brago.roles["Venser, the Sojourner"]}; Eerie Interlude none; Flickerwisp ${R.brago.roles["Flickerwisp"]})`);
      ok(R.brago.cats.find(c => c.startsWith("Blink:")) === "Blink: 34 cards/34 copies · en 15 · pay 21 · amp 3", `${label}: 2A Brago's Blink: 15 enabling (was 10), 21 rewarding, 3 amplifying (${R.brago.cats.find(c => c.startsWith("Blink:"))})`);
      for (const n of ["Ghostly Flicker", "Ephemerate", "Cloudshift", "Momentary Blink", "Restoration Angel", "Felidar Guardian", "Teleportation Circle", "Soulherder", "Deadeye Navigator", "Brago, King Eternal"]) ok(has("brago", n, "blink/enabler"), `${label}: 2A ${n} still a blink enabler`);
      ok(["Panharmonicon", "Elesh Norn, Mother of Machines", "Starfield Vocalist"].every(n => R.brago.sy[n].join() === "blink/amplifier"), `${label}: 2A Panharmonicon, Elesh Norn and Starfield Vocalist unchanged in Brago`);
      // temporary exile (until it leaves; returned when this leaves the battlefield) is not blink; their functional roles stay what they were
      m = await mini("Krenko, Mob Boss", ["Oblivion Ring", "Fiend Hunter", "Banisher Priest", "Journey to Nowhere", "Mulldrifter", "Wall of Omens"]);
      ok(["Oblivion Ring", "Fiend Hunter", "Banisher Priest", "Journey to Nowhere"].every(n => !m.sy[n].some(x => x.startsWith("blink/enabler"))), `${label}: 2A Oblivion Ring, Fiend Hunter, Banisher Priest and Journey to Nowhere aren't blink enablers (${["Oblivion Ring", "Fiend Hunter", "Banisher Priest", "Journey to Nowhere"].map(n => n + ": " + m.sy[n]).join(" | ")})`);
      ok(m.roles["Banisher Priest"] === "Removal,Creature" && m.roles["Journey to Nowhere"] === "Removal" && m.roles["Oblivion Ring"] === "" && m.roles["Fiend Hunter"] === "Creature", `${label}: 2A their functional roles are unchanged (Oblivion Ring and Fiend Hunter miss Removal before and after: "exile another target", a Stage 2D item) (${["Oblivion Ring", "Fiend Hunter", "Banisher Priest", "Journey to Nowhere"].map(n => n + ": " + m.roles[n]).join(" | ")})`);
      ok(["Mulldrifter", "Wall of Omens", "Fiend Hunter"].every(n => m.sy[n].includes("blink/payoff/notcounted")) && !m.imbKeys.length, `${label}: 2A with no blink card, enters abilities stay potential (not counted), and nothing to say`);
      // one end-step blink card is a blink card: the deck's enters abilities count, as with Cloudshift
      m = await mini("Krenko, Mob Boss", ["Eerie Interlude", "Mulldrifter", "Wall of Omens", "Panharmonicon"]);
      ok(m.sy["Eerie Interlude"].join() === "blink/enabler" && ["Mulldrifter", "Wall of Omens"].every(n => m.sy[n].includes("blink/payoff")) && m.sy["Panharmonicon"].join() === "blink/amplifier", `${label}: 2A with Eerie Interlude, the enters abilities and Panharmonicon count, as they do with any blink card (${m.sy["Mulldrifter"]} | ${m.sy["Panharmonicon"]})`);
      m = await mini("Krenko, Mob Boss", ["Cloudshift", "Mulldrifter", "Wall of Omens", "Panharmonicon"]);
      const m2 = await mini("Krenko, Mob Boss", ["Eerie Interlude", "Mulldrifter", "Wall of Omens", "Panharmonicon"]);
      ok(JSON.stringify(m.cats) === JSON.stringify(m2.cats) && JSON.stringify(m.imbKeys) === JSON.stringify(m2.imbKeys), `${label}: 2A Eerie Interlude and Cloudshift give the same Blink sums and observations (${m2.cats.find(c => c.startsWith("Blink"))})`);

      // ---- Stage 2B: Voltron. W = Wyleth's cards; v(r, n) = a card's Voltron entries
      const v = (r, n) => (r.sy[n] || []).filter(x => x.startsWith("voltron")), vw = n => v(R.wyleth, n), vwhy = (r, n) => (r.why[n] || []).filter(w => w.startsWith("voltron"));
      // payoffs: cards that reward equipped or enchanted creatures
      for (const n of ["Reyav, Master Smith", "Akiri, Fearless Voyager", "Puresteel Paladin"]) ok(vw(n).includes("voltron/payoff"), `${label}: 2B ${n} rewards Auras and Equipment (${vwhy(R.wyleth, n)})`);
      for (const n of ["Wyleth, Soul of Steel", "Bruenor Battlehammer", "Mantle of the Ancients", "Thran Power Suit", "Sram, Senior Edificer"]) ok(vw(n).includes("voltron/payoff"), `${label}: 2B ${n} still a Voltron payoff`);
      ok(["Shared Animosity", "Raid Bombardment", "Battle Cry Goblin"].every(n => !v(R.krenko, n).length), `${label}: 2B rewarding attacking creatures (Shared Animosity, Raid Bombardment) isn't Voltron`);
      // attach engines
      for (const n of ["Brass Squire", "Ardenn, Intrepid Archaeologist", "Sigarda's Aid"]) ok(vwhy(R.wyleth, n).some(w => /^voltron\/enabler: Attaches Auras or Equipment · /.test(w)) && !vw(n).includes("voltron/payoff"), `${label}: 2B ${n} attaches Auras or Equipment (${vwhy(R.wyleth, n)})`);
      const HALVAR = "Halvar, God of Battle // Sword of the Realms";
      m = await mini("Wyleth, Soul of Steel", ["Kor Outfitter", "Armory Automaton", HALVAR, "Hero's Blade", "Hammer of Nazahn"]);
      ok(["Kor Outfitter", "Armory Automaton"].every(n => vwhy(m, n).some(w => /Attaches Auras or Equipment/.test(w))) && v(m, HALVAR).includes("voltron/payoff"), `${label}: 2B Kor Outfitter and Armory Automaton attach Equipment; Halvar ("Creatures you control that are enchanted or equipped have double strike") rewards it (${vwhy(m, "Kor Outfitter")} | ${vwhy(m, "Armory Automaton")} | ${vwhy(m, HALVAR)})`);
      ok(["Hero's Blade", "Hammer of Nazahn"].every(n => vwhy(m, n).some(w => /^voltron\/enabler: Builds up one creature · Equipped creature gets/.test(w))), `${label}: 2B Equipment that attaches itself (Hero's Blade, Hammer of Nazahn) is described as the gear it is`);
      // equip cost and Aura/Equipment cost
      for (const n of ["Bruenor Battlehammer", "Forge Anew"]) ok(vwhy(R.wyleth, n).some(w => /^voltron\/enabler: Makes Equipment cheaper to attach · You may pay \{0\} rather than pay the equip cost/.test(w)), `${label}: 2B ${n}: an alternative equip cost (${vwhy(R.wyleth, n)})`);
      ok(vwhy(R.wyleth, "Puresteel Paladin").some(w => /^voltron\/enabler: Makes Equipment cheaper to attach · Metalcraft — Equipment you control have equip \{0\}/.test(w)) && R.wyleth.sy["Puresteel Paladin"].includes("artifacts/payoff"), `${label}: 2B Puresteel Paladin: equip {0}, an Equipment payoff, and its metalcraft artifacts payoff kept`);
      ok(vwhy(R.wyleth, "Danitha Capashen, Paragon").some(w => /Makes Auras and Equipment cheaper/.test(w)), `${label}: 2B Danitha ("Aura and Equipment spells you cast cost {1} less") makes Voltron gear cheaper`);
      // Equipment tutors; other tutors unchanged
      for (const n of ["Stoneforge Mystic", "Steelshaper's Gift", "Open the Armory", "Relic Seeker", "Fighter Class", "Astor, Bearer of Blades"]) ok(vw(n).includes("voltron/enabler") && vwhy(R.wyleth, n).some(w => /Finds Equipment/.test(w)), `${label}: 2B ${n} finds Equipment, counted (${R.wyleth.sy[n]})`);
      ok(!v(R.sythis, "Idyllic Tutor").length && !v(R.sythis, "Eladamri's Call").length && !v(R.shorikai, "Enlightened Tutor").length && R.shorikai.sy["Enlightened Tutor"].join() === "artifacts/payoff", `${label}: 2B other tutors aren't Voltron; Enlightened Tutor unchanged (${R.shorikai.sy["Enlightened Tutor"]})`);
      // gear
      ok(vwhy(R.wyleth, "On Serra's Wings").some(w => /Builds up one creature · Enchanted creature is legendary, gets \+1\/\+1/.test(w)), `${label}: 2B On Serra's Wings ("is legendary, gets +1/+1") builds up a creature`);
      for (const [n, q] of [["Basilisk Collar", "Equipped creature has deathtouch and lifelink"], ["Swiftfoot Boots", "Equipped creature has hexproof and haste"], ["Timely Ward", "Enchanted creature has indestructible"], ["Unquestioned Authority", "Enchanted creature has protection from creatures"], ["Ring of Thune", "Equipped creature has vigilance"], ["Ring of Valkas", "Equipped creature has haste"]])
        ok(vwhy(R.wyleth, n).join() === `voltron/enabler: Protects or strengthens the creature you build up · ${q}`, `${label}: 2B ${n} in Wyleth (a Voltron commander): "${q}" (${vwhy(R.wyleth, n)})`);
      ok(R.wyleth.cats.find(c => c.startsWith("Voltron:")) === "Voltron: 41 cards/41 copies · en 38 · pay 7" && !R.wyleth.cats.some(c => c.startsWith("Go-wide")), `${label}: 2B Wyleth's Voltron: 41 cards, 38 enabling, 7 rewarding (was 21, 18, 7); no Go-wide category (${R.wyleth.cats.filter(c => /^(Voltron|Go-wide|Artifacts)/.test(c))})`);
      // protective gear without a Voltron foundation isn't Voltron: Krenko, Brago, Sythis, Mizzix, Meren, Atraxa, Lathril
      ok(["Lightning Greaves", "Swiftfoot Boots", "Thornbite Staff"].every(n => !v(R.krenko, n).length) && R.krenko.cats.includes("Voltron: 1 cards/1 copies · en 1 · pay 0"), `${label}: 2B Krenko: Lightning Greaves and Swiftfoot Boots don't make it a Voltron deck; Voltron still only Sting (${R.krenko.cats.find(c => c.startsWith("Voltron"))})`);
      ok(["Lightning Greaves", "Swiftfoot Boots", "Unquestioned Authority"].every(n => !v(R.brago, n).length) && !R.brago.cats.some(c => c.startsWith("Voltron")), `${label}: 2B Brago: its protective gear isn't Voltron`);
      ok(["Flickering Ward", "Whip Silk"].every(n => !v(R.sythis, n).length) && R.sythis.cats.includes("Voltron: 6 cards/6 copies · en 5 · pay 1"), `${label}: 2B Sythis (one Voltron payoff): Flickering Ward isn't counted, Whip Silk (reach) never is; Voltron unchanged`);
      ok(["mizzix", "meren", "atraxa", "lathril"].every(id => !v(R[id], "Lightning Greaves").length && !v(R[id], "Swiftfoot Boots").length), `${label}: 2B Lightning Greaves and Swiftfoot Boots aren't Voltron in Mizzix, Meren, Atraxa or Lathril`);
      const GEAR = ["Swiftfoot Boots", "Lightning Greaves", "Basilisk Collar"];
      m = await mini("Krenko, Mob Boss", GEAR);
      ok(GEAR.every(n => !v(m, n).length) && !m.cats.some(c => c.startsWith("Voltron")), `${label}: 2B protective gear alone: no Voltron`);
      m = await mini("Krenko, Mob Boss", [...GEAR, "Sram, Senior Edificer"]);
      ok(GEAR.every(n => !v(m, n).length), `${label}: 2B with one Voltron payoff (Sram) the protective gear still doesn't count`);
      m = await mini("Krenko, Mob Boss", [...GEAR, "Reyav, Master Smith", "Akiri, Fearless Voyager"]);
      ok(GEAR.every(n => v(m, n).join() === "voltron/enabler"), `${label}: 2B with two Voltron payoffs (Reyav, Akiri) it counts (${GEAR.map(n => v(m, n)).join(" | ")})`);
      m = await mini("Wyleth, Soul of Steel", GEAR);
      ok(GEAR.every(n => v(m, n).join() === "voltron/enabler"), `${label}: 2B with a Voltron commander (Wyleth) it counts`);
      m = await mini("Krenko, Mob Boss", GEAR, "Voltron");
      ok(GEAR.every(n => v(m, n).join() === "voltron/enabler"), `${label}: 2B with a Voltron theme it counts`);
      // misleading classifications corrected
      ok(!v(R.wyleth, "Explorer's Scope").length && R.wyleth.unknown.includes("Explorer's Scope"), `${label}: 2B Explorer's Scope ("Whenever equipped creature attacks, look at the top card…") is not a Voltron payoff (${R.wyleth.sy["Explorer's Scope"]})`);
      for (const n of ["Sword of Feast and Famine", "Sword of the Animist"]) ok(vw(n).join() === "voltron/enabler", `${label}: 2B ${n}: gear (it builds up the creature), not a payoff for its own combat trigger (${vw(n)})`);
      ok(!R.wyleth.sy["Fighter Class"].some(x => x.startsWith("gowide")), `${label}: 2B Fighter Class's forced block isn't a go-wide payoff (${R.wyleth.sy["Fighter Class"]})`);
      ok(!R.wyleth.sy["Astor, Bearer of Blades"].some(x => x.startsWith("artifacts")) && R.wyleth.cats.includes("Artifacts: 2 cards/2 copies · en 0 · pay 2"), `${label}: 2B Astor's "Vehicles you control have crew 1" says nothing in a deck with no Vehicles (${R.wyleth.sy["Astor, Bearer of Blades"]})`);
      m = await mini("Shorikai, Genesis Engine", ["Astor, Bearer of Blades", "Smuggler's Copter", "Parhelion II"].filter(n => FIX.cards[n]));
      ok(m.sy["Astor, Bearer of Blades"].includes("artifacts/payoff") && m.sy["Astor, Bearer of Blades"].includes("artifacts/enabler"), `${label}: 2B with Vehicles in the deck, Astor's crew text still counts for Artifacts (${m.sy["Astor, Bearer of Blades"]})`);
      ok(R.shorikai.cats.find(c => c.startsWith("Artifacts:")) === "Artifacts: 32 cards/32 copies · en 10 · pay 27", `${label}: 2B Shorikai's Artifacts (Vehicles) unchanged`);

      // ---- H4: graveyard setup and reanimation
      for (const n of ["Animate Dead", "Reanimate", "Living Death"]) ok(has("meren", n, "graveyard/payoff") && R.meren.why[n].some(w => /reanimation/.test(w)), `${label}: H4 ${n} returns creatures from a graveyard to the battlefield (reanimation) (${R.meren.why[n]})`);
      for (const n of ["Entomb", "Buried Alive", "Grisly Salvage", "Satyr Wayfinder"]) ok(has("meren", n, "graveyard/enabler"), `${label}: H4 ${n} puts cards from the library into the graveyard, counted (${R.meren.sy[n]})`);
      ok(["Animate Dead", "Living Death", "Grisly Salvage", "Satyr Wayfinder"].every(n => !R.meren.unknown.includes(n)), `${label}: H4 none of them is left under "No role identified" (${R.meren.unknown})`);
      ok(R.meren.cats.find(c => c.startsWith("Graveyard:")) === "Graveyard: 13 cards/13 copies · en 5 · pay 8 · incidental 1", `${label}: H4 Meren's Graveyard strategy: 13 cards, 5 enabling, 8 rewarding (${R.meren.cats.find(c => c.startsWith("Graveyard:"))})`);
      ok(has("atraxa", "Teferi, Master of Time", "graveyard/enabler/incidental/notcounted") && has("meren", "Yawgmoth, Thran Physician", "graveyard/enabler/incidental/notcounted") && !any("meren", "Village Rites", "graveyard"), `${label}: H4 looting and discard costs stay incidental; a sacrifice spell isn't graveyard support`);
      ok(R.meren.why["Eternal Witness"].some(w => /Uses your graveyard/.test(w)) && !R.meren.why["Eternal Witness"].some(w => /reanimation/.test(w)), `${label}: H4 returning a card to the hand is graveyard use, not reanimation`);

      // ---- preserved: Krenko, Mizzix, Shorikai exactly as before
      for (const id of ["krenko", "mizzix", "shorikai"]) for (const f of Object.keys(FIX.before[id])) { const same = JSON.stringify(R[id][f]) === JSON.stringify(FIX.before[id][f]);
        ok(same, `${label}: ${id} ${f} unchanged${same ? "" : ": now " + JSON.stringify(R[id][f])}`); }
      const imbAll = Object.keys(FIX.decks).map(k => k + ":" + R[k].imbKeys.join("+")).join(" ");
      ok(imbAll === "krenko: mizzix: shorikai: teysa: meren: atraxa: sythis:counters-makers tatyova: wyleth: brago: lathril:sacrifice", `${label}: the observations in all eleven decks (${imbAll})`);

      // ---- H5: the theme line counts the deck's own cards of the theme's type, apart from what supports it (in the app, at this width)
      const front = c => (c.type_line || "").split("//")[0], typeN = (id, f) => FIX.decks[id].slice(1).reduce((a, [n, q]) => a + (f(FIX.cards[n]) ? q : 0), 0);
      const ctN = (id, t) => typeN(id, c => /\b(Creature|Kindred|Tribal)\b/.test(front(c).split("—")[0]) && (front(c).split("—")[1] || "").trim().split(/\s+/).includes(t));
      const expect = { sythis: `${typeN("sythis", c => /\bEnchantment\b/.test(front(c)))} enchantments`, lathril: `${ctN("lathril", "Elf")} Elf cards`, krenko: `${ctN("krenko", "Goblin")} Goblin cards`,
        shorikai: `${typeN("shorikai", c => /\bVehicle\b/.test(front(c)))} Vehicles`, mizzix: `${typeN("mizzix", c => /\b(Instant|Sorcery)\b/.test(front(c)))} instants and sorceries`, wyleth: `${typeN("wyleth", c => /\bEquipment\b/.test(front(c)))} Equipment` };
      const view = async id => { await p.evaluate(id => { deckTab[id] = "balance"; balMode[id] = "optimize"; go("decks", id); }, id); await p.waitForSelector("#opStratTheme p", { state: "attached", timeout: 20000 });
        await p.$eval("#op-strat", e => { e.open = true; }); await p.waitForTimeout(150);
        return p.evaluate(() => ({ t: document.querySelector("#opStratTheme p").textContent.replace(/\s+/g, " ").trim(), cmd: (document.querySelector("#opStratCmd") || {}).textContent.replace(/\s+/g, " ").trim(), over: document.documentElement.scrollWidth > innerWidth + 1 })); };
      for (const id of Object.keys(expect)) { const t = await view(id); ok(t.t.includes(`: ${expect[id]} in the deck. `) && !t.over, `${label}: H5 ${id}: "${t.t}" (counted from the fixture: "${expect[id]}"; no sideways scrolling)`); }
      let t = await view("sythis");
      ok(t.t === `Your theme Enchantments → Enchantments: ${expect.sythis} in the deck. 20 cards (20 copies): 20 rewarding it.` && !/0 enabling/.test(t.t), `${label}: H5 Sythis no longer says "0 enabling it" (${t.t})`);
      ok(+expect.sythis.split(" ")[0] >= 40, `${label}: H5 the count is the deck's enchantments (${expect.sythis}), not its payoffs (20)`);
      t = await view("lathril");
      ok(t.t === `Your theme Elves → Creature type: Elf: ${expect.lathril} in the deck. 34 cards (34 copies): 9 enabling it, 33 rewarding it.`, `${label}: H5 Lathril: Elf cards in the deck, then the cards that enable and reward Elves (${t.t})`);
      t = await view("teysa");
      ok(t.t === "Your theme Aristocrats → Sacrifice: 38 cards (38 copies): 11 enabling it, 23 rewarding it.", `${label}: H5 a strategy theme that isn't a card type (Aristocrats) keeps the old line (${t.t})`);
      ok(t.cmd === "Your commander supports: Tokens (rewards it), Sacrifice (amplifies it).", `${label}: H3 Teysa's commander line says she amplifies Sacrifice (${t.cmd})`);
      t = await view("brago"); const bl = await p.$eval("#op-st-blink", e => e.textContent.replace(/\s+/g, " "));
      ok(/34 cards · 34 copies · 15 enabling · 21 rewarding · 3 amplifying/.test(bl) && /Makes enters-the-battlefield triggers happen twice · “If an artifact or creature entering causes a triggered ability/.test(bl), `${label}: H3 Brago's Blink section lists the 3 amplifiers with why and the quote`);
      ok(!errs.length, `${label}: no page errors (${errs.join(" | ")})`);
      if (label === "phone") { await view("sythis"); await p.screenshot({ path: "strategies_r2_phone.png" }); }
      await ctx.close();
    }
  } finally { await b.close(); srv.kill(); }
})().catch(e => { console.log("FAIL", e.stack); process.exitCode = 1; });
