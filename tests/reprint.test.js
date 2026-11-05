// Reprint risk: a transparent read of a card's printing history (Scryfall), on the card screen and in the Market tab.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const ymd = daysAgo => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
const P = (name, set, type, daysAgo, o = {}) => Object.assign({ object: "card", id: name + set, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase() + " Set", set_type: type, released_at: ymd(daysAgo), collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.50" }, finishes: ["nonfoil"], games: ["paper"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } }, o);
const PRINTS = {
  "Sol Ring": [P("Sol Ring", "lea", "core", 11800), P("Sol Ring", "c13", "commander", 4700), P("Sol Ring", "c14", "commander", 4300), P("Sol Ring", "c15", "commander", 3900), P("Sol Ring", "2xm", "masters", 2200), P("Sol Ring", "cmr", "draft_innovation", 1800),
    P("Sol Ring", "cmm", "masters", 820, { edhrec_rank: 1 }), P("Sol Ring", "moc", "commander", 950), P("Sol Ring", "fic", "commander", 140, { border_color: "borderless" }), P("Sol Ring", "sld", "box", 300, { frame_effects: ["showcase"] })],
  "Black Lotus": [P("Black Lotus", "lea", "core", 11800, { reserved: true, prices: { usd: "20000" } }), P("Black Lotus", "leb", "core", 11700, { reserved: true })],
  "Brand New": [P("Brand New", "new", "expansion", 60, { prices: { usd: "8" } })],
  "Coming Back": [P("Coming Back", "old", "expansion", 3000, { prices: { usd: "25" }, edhrec_rank: 300 }), P("Coming Back", "nxt", "expansion", -30)],
};
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8807", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], asked = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://raw.githubusercontent.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "404" }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), H = { "Access-Control-Allow-Origin": "*" }, m = u.match(/!"([^"]+)"/);
    if (u.includes("/cards/search") && m && PRINTS[m[1]]) { asked.push(m[1]); return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: PRINTS[m[1]], has_more: false }) }); }
    r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8807/app_real.html"); await p.waitForTimeout(500);
  const slimOf = n => ({ id: n + "x", oid: "o-" + n, name: n, set: "x", setName: "X", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1.5" }, finishes: ["nonfoil"] });
  const R = {}, look = async n => { await p.evaluate(c => { closeSheet(); openCard(c, "nonfoil"); }, slimOf(n)); await p.waitForFunction(() => /Reprint risk/.test((document.querySelector("#rrBox") || {}).textContent || "") || /couldn't/.test((document.querySelector("#rrBox") || {}).textContent || ""), null, { timeout: 8000 }); return p.$eval("#rrBox", e => e.textContent.replace(/\s+/g, " ").trim()); };
  R.sol = await look("Sol Ring"); if (shot) { await p.$eval("#rrBox", e => e.scrollIntoView()); await p.screenshot({ path: __dirname + "/" + shot }); }
  R.lotus = await look("Black Lotus"); R.fresh = await look("Brand New"); R.coming = await look("Coming Back");
  // switching finish / redraws don't look it up again
  const n0 = asked.length; await p.evaluate(() => { const b = document.querySelector('#finSeg [data-f]'); b && b.click(); }); await p.waitForTimeout(300); R.again = asked.length - n0;
  await p.evaluate(() => closeSheet());
  // Market: watched cards show their level; a confirmed reprint on an Up call is flagged
  await p.evaluate(([a, b]) => { const mkS = (c, dir) => { const id = uid(); S.spec[id] = { id, card: c, finish: "nonfoil", created: Date.now(), updated: Date.now(), status: "active", reason: "r", notes: [], pred: { dir, days: 30, entry: null, exit: null, start: 1, at: Date.now() }, track: [] }; return id; };
    mkS(a, "up"); window.__id = mkS(b, "up"); save(); go("market"); }, [slimOf("Sol Ring"), slimOf("Coming Back")]);
  await p.waitForTimeout(1500); R.rows = await p.$$eval("#view .list .item", a => a.map(x => x.textContent.replace(/\s+/g, " ").trim()));
  await p.evaluate(() => specSheet(S.spec[window.__id])); await p.waitForFunction(() => /Reprint risk/.test((document.querySelector("#spRR") || {}).textContent || ""), null, { timeout: 8000 });
  R.sheet = await p.$eval("#spRR", e => e.textContent.replace(/\s+/g, " "));
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "reprint_phone.png"]]) {
    const R = await run(opts, shot);
    ok(/Reprint risk ?High/.test(R.sol) && /Printed in 10 different sets and products: reprinted often\. \(\+2\)/.test(R.sol) && /printings in the last 3 years\. \(\+2\)/.test(R.sol) && /\d Masters sets? and \d Commander products?: products built around reprints\. \(\+1\)/.test(R.sol) && /#1 on EDHREC/.test(R.sol), `[${label}] Sol Ring: High, with each factor and its points: ${R.sol.slice(0, 260)}`);
    ok(/special treatments \(.*borderless.*\)|special treatments \(.*showcase.*\)/.test(R.sol), `[${label}] lists special treatments`);
    ok(/isn't a forecast of what Wizards will do/.test(R.sol) && /Source: Scryfall \(all paper printings\), checked Today/.test(R.sol), `[${label}] says it describes the past, names the source and date`);
    ok(/Reprint risk ?Reserved List/.test(R.lotus) && !/Limited/.test(R.lotus) && /published policy is not to reprint/.test(R.lotus) && !/\(\+\d\)/.test(R.lotus), `[${label}] Reserved List cards: policy stated, no points (${R.lotus.slice(0, 140)})`);
    ok(/Limited assessment: it has only been printed once, its first printing is less than a year old, there's no EDHREC rank/.test(R.fresh), `[${label}] thin data is called a limited assessment (${R.fresh.match(/Limited[^.]*/)})`);
    ok(/Reprint risk ?Reprint confirmed/.test(R.coming) && /scores \d, but a new printing is already listed/.test(R.coming) && /Confirmed: a new printing in NXT Set \(/.test(R.coming) && /listed on Scryfall/.test(R.coming), `[${label}] a printing from a revealed but unreleased set is the only thing shown as confirmed (${R.coming.slice(0, 160)})`);
    ok(R.again === 0, `[${label}] looked up once per card, not on every redraw`);
    const sol = R.rows.find(r => /Sol Ring/.test(r)) || "", cb = R.rows.find(r => /Coming Back/.test(r)) || "";
    ok(/Reprint: High/.test(sol) && /Reprint coming/.test(cb), `[${label}] Market rows show the reprint level, and flag a confirmed reprint on an Up call (${sol.slice(-30)} / ${cb.slice(-30)})`);
    ok(/Reprint risk/.test(R.sheet) && /Confirmed/.test(R.sheet), `[${label}] reprint risk in the watched card's details`);
    ok(!R.overflow, `[${label}] no sideways scrolling`);
    ok(!R.errs.length, `[${label}] no console errors ${JSON.stringify(R.errs)}`);
  }
})();
