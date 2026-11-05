// Combos tab: known combos (from the daily Commander Spellbook copy) in the deck and one card away; the bracket check uses two-card combos.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const ALL = { as_of: "2026-11-05T16:11:55+00:00", source: "Commander Spellbook (commanderspellbook.com)",
  cards: ["Kiki-Jiki, Mirror Breaker", "Zealous Conscripts", "Pestermite", "Felidar Guardian", "Tidespout Tyrant", "Sol Ring", "Krenko, Mob Boss", "Thornbite Staff", "Splinter Twin", "Deceiver Exarch", "Basalt Monolith", "Rings of Brighthearth"],
  feats: ["Infinite creature tokens with haste", "Infinite death triggers", "Infinite colorless mana", "Infinite creature tokens"], tmpl: ["Permanent castable for {C}"],
  combos: [["1-2", [0, 1], [0, 1], [], 28214, "R"], ["1-3", [0, 2], [0], [], 20000, "UR"], ["1-4", [0, 3], [0], [], 15000, "RW"], ["5-6", [4, 5], [2], [0], 38005, "U"], ["7-8", [-7, 7], [3], [], 5000, "R"],
    ["9-10", [8, 9], [0], [], 9000, "UR"], ["11-12-6", [10, 11, 5], [2], [], 4000, "C"]] };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8803", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], asked = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://raw.githubusercontent.com/junkcase/Deckhand/data/**", r => { const k = r.request().url().split("/data/")[1]; asked.push(k);
    const body = k === "combos/meta.json" ? { as_of: ALL.as_of, combos: 7 } : k === "combos/all.json" ? ALL : null;
    r.fulfill({ status: body ? 200 : 404, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: body ? JSON.stringify(body) : "404" }); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    const m = u.match(/named\?exact=([^&]+)/); if (m) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ object: "card", id: "fel", oracle_id: "of", name: m[1], set: "kld", set_name: "Kaladesh", collector_number: "1", rarity: "uncommon", type_line: "Creature — Cat Beast", cmc: 4, mana_cost: "{3}{W}", colors: ["W"], color_identity: ["W"], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } }) });
    if (u.includes("is:gamechanger") || u.includes("otag:")) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: [], has_more: false }) });
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8803/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => {
    const mk = (id, name, ci, type) => ({ id, oid: "o" + id, name, set: "x", setName: "X", num: "1", rarity: "rare", type: type || "Creature", cmc: 3, mana: "{2}{R}", colors: ci, ci, img: "", prices: { usd: "1" }, finishes: ["nonfoil"], leg: { commander: "l" }, roles: [] });
    addToColl(mk("pe", "Pestermite", ["U"]), "nonfoil", 1, "main");
    const cards = {}; for (const c of [mk("kj", "Kiki-Jiki, Mirror Breaker", ["R"], "Legendary Creature — Goblin Shaman"), mk("zc", "Zealous Conscripts", ["R"]), mk("sr", "Sol Ring", [], "Artifact"), mk("dx", "Deceiver Exarch", ["U"])]) cards[c.id + "|0"] = Object.assign(c, { qty: 1 });
    S.decks.d = { id: "d", name: "Kiki", format: "commander", cmdr: ["kj|0"], cards, created: 1, updated: 1 }; save(); go("decks", "d"); });
  await p.waitForTimeout(300);
  await p.click('#dTabs [data-t="combos"]'); await p.waitForSelector(".combo", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(200);
  const look = () => p.evaluate(() => ({ head: document.querySelector("#dPane .kv .num").textContent, combos: [...document.querySelectorAll("#dPane .combo")].map(x => [...x.querySelectorAll(".chip")].map(c => c.textContent).join(" | ") + " :: " + (x.querySelector(".small") || {}).textContent),
    links: [...document.querySelectorAll("#dPane .combo a")].map(a => a.href) }));
  const R = {};
  R.v = await look();
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  R.tabs = await p.$$eval("#dTabs button", a => a.map(x => x.textContent));
  // add the missing piece of Kiki + Felidar... wait, Felidar is white: outside Kiki's colours, so not offered. Add Pestermite (blue? Kiki is mono-red: also outside) → only red/colourless combos
  R.addBtns = await p.$$eval("[data-cadd]", a => a.map(x => x.dataset.cadd));
  // bracket: the Balance tab lists two-card combos
  await p.click('#dTabs [data-t="balance"]'); await p.waitForFunction(() => /Two-card|Game Changers|No Game/.test((document.querySelector("#brBox") || {}).textContent || "") && !/Checking/.test(document.querySelector("#brBox").textContent), null, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(300); R.bracket = await p.$eval("#brBox", e => e.textContent.replace(/\s+/g, " "));
  // a blue-red deck: Kiki + Pestermite is one card away and you own Pestermite
  await p.evaluate(() => { const d = S.decks.d; d.cards["dx|0"].ci = ["U"]; Object.assign(d.cards["kj|0"], { ci: ["U", "R"] }); deckTab.d = "combos"; save(); renderDeck(d); });
  await p.waitForTimeout(400); R.ur = await look();
  R.addBtns2 = await p.$$eval("[data-cadd]", a => a.map(x => x.dataset.cadd));
  await p.click('#cbOwn [data-o="1"]'); await p.waitForTimeout(150); R.own = await p.$$eval("[data-cadd]", a => a.map(x => x.dataset.cadd));
  await p.click('#cbOwn [data-o="0"]'); await p.waitForTimeout(150);
  await p.click('[data-cadd="Pestermite"]'); await p.waitForTimeout(600); R.after = await look(); R.inDeck = await p.evaluate(() => Object.values(S.decks.d.cards).some(c => c.name === "Pestermite"));
  R.files = [...new Set(asked)].filter(k => k.startsWith("combos")).sort();
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "combos_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.tabs.join("|") === "Cards|Suggestions|Balance|Upgrade|Combos", `[${label}] deck has a Combos tab ${JSON.stringify(R.tabs)}`);
    ok(R.v.head === "1 in this deck · 0 one card away", `[${label}] mono-red Kiki: Kiki + Conscripts in the deck; blue, white and must-be-your-commander combos left out; a 3-card combo missing 2 pieces isn't listed (${R.v.head})`);
    ok(/Kiki-Jiki, Mirror Breaker \| ✓?.*Zealous Conscripts \| Two-card combo/.test(R.v.combos[0]) && /Infinite creature tokens with haste · Infinite death triggers/.test(R.v.combos[0]), `[${label}] the combo, what it gives, and that it's a two-card combo: ${R.v.combos[0]}`);
    ok(R.v.links[0] === "https://commanderspellbook.com/combo/1-2/", `[${label}] links to the steps on Commander Spellbook`);
    ok(JSON.stringify(R.own) === '["Pestermite"]', `[${label}] "Cards I own" narrows the one-card-away list to pieces you have ${JSON.stringify(R.own)}`);
    ok(/Two-card combos \(1\): Kiki-Jiki, Mirror Breaker \+ Zealous Conscripts/.test(R.bracket) && /3 \(Upgraded\)/.test(R.bracket) && /two-card combo/.test(R.bracket), `[${label}] bracket check now counts two-card combos: ${R.bracket.slice(0, 220)}`);
    ok(JSON.stringify(R.addBtns2) === '["Tidespout Tyrant","Pestermite","Splinter Twin"]' && /\+ Pestermite/.test(R.ur.combos.join()) && /You own 1/.test(R.ur.combos.find(c => /Pestermite/.test(c)) || ""), `[${label}] in blue-red, Kiki + Pestermite is one card away and it says you own it ${JSON.stringify(R.addBtns2)}`);
    ok(R.inDeck && /2 in this deck/.test(R.after.head), `[${label}] "Add Pestermite to the deck" adds it and the combo moves to In this deck (${R.after.head})`);
    ok(JSON.stringify(R.files) === '["combos/all.json","combos/meta.json"]', `[${label}] loads the combo list once ${JSON.stringify(R.files)}`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
