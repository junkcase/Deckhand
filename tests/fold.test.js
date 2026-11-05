// Deck sections (Commander, Creatures, Instants…) fold away with a tap, remembered per deck; Collapse all / Expand all.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8802", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8802/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { const cards = {}, mk = (id, name, type, side) => { cards[id + "|" + (side ? 1 : 0)] = { id, name, type, set: "cmm", num: "1", qty: 1, cmc: 2, side: !!side, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: { commander: "l" }, roles: [] }; };
    mk("k", "Krenko, Mob Boss", "Legendary Creature — Goblin"); mk("g", "Goblin Chieftain", "Creature — Goblin"); mk("h", "Goblin Matron", "Creature — Goblin"); mk("b", "Lightning Bolt", "Instant"); mk("s", "Sol Ring", "Artifact"); mk("m", "Mountain", "Basic Land — Mountain"); mk("x", "Pyroblast", "Instant", true);
    S.decks.d = { id: "d", name: "Krenko", format: "commander", cmdr: ["k|0"], cards, created: 1, updated: 1 }; save(); go("decks", "d"); });
  await p.waitForTimeout(300);
  const st = () => p.evaluate(() => ({ heads: [...document.querySelectorAll("#dl [data-fold]")].map(b => (b.children[0].textContent.replace(/[▾\s]+/g, " ").trim() + " " + b.children[1].textContent) + (b.getAttribute("aria-expanded") === "false" ? " (folded)" : "")), rows: [...document.querySelectorAll("#dl .item .name")].map(x => x.textContent) }));
  const R = {};
  R.start = await st();
  const head = t => p.evaluateHandle(t => [...document.querySelectorAll("#dl [data-fold]")].find(b => b.textContent.includes(t)), t);
  await (await head("Creature")).asElement().click(); await p.waitForTimeout(150); R.fold1 = await st();
  if (shot) await p.screenshot({ path: __dirname + "/" + shot, fullPage: true });
  await p.evaluate(() => { go("coll"); go("decks", "d"); }); await p.waitForTimeout(200); R.remembered = await st();
  await (await head("Creature")).asElement().click(); await p.waitForTimeout(150); R.unfold = await st();
  await p.click("#dFoldAll"); await p.waitForTimeout(150); R.all = await st();
  await p.click("#dOpenAll"); await p.waitForTimeout(150); R.none = await st();
  R.inc = await p.evaluate(() => { document.querySelector('#dl [data-inc="b|0"]').click(); return S.decks.d.cards["b|0"].qty; });
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "fold_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.start.heads.length === 6 && R.start.heads[0] === "Commander 1" && R.start.heads.some(h => h === "Creature 2") && R.start.heads.at(-1) === "Side · Instant 1" && R.start.rows.length === 7, `[${label}] every section has a tappable heading ${JSON.stringify(R.start.heads)}`);
    ok(R.fold1.heads.includes("Creature 2 (folded)") && !R.fold1.rows.includes("Goblin Chieftain") && R.fold1.rows.includes("Lightning Bolt") && R.fold1.rows.length === 5, `[${label}] tapping Creature folds just that section; its count still shows ${JSON.stringify(R.fold1)}`);
    ok(R.remembered.heads.includes("Creature 2 (folded)"), `[${label}] remembered when you come back to the deck`);
    ok(!R.unfold.heads.some(h => /folded/.test(h)) && R.unfold.rows.length === 7, `[${label}] tap again to open it`);
    ok(R.all.heads.every(h => /folded/.test(h)) && R.all.rows.length === 0, `[${label}] Collapse all ${JSON.stringify(R.all.heads)}`);
    ok(R.none.rows.length === 7, `[${label}] Expand all`);
    ok(R.inc === 2, `[${label}] + and − on cards still work`);
    ok(!R.overflow && !R.errs.length, `[${label}] no sideways scrolling, no errors ${JSON.stringify(R.errs)}`);
  }
})();
