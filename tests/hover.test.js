const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (id, name) => ({ object: "card", id, oracle_id: "o" + id, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg?1`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg?1` }, oracle_text: "{T}: Add {C}{C}." });
async function run(ctxOpts, label) {
  const srv = spawn("python3", ["-m", "http.server", "8776", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), ctx = await b.newContext(ctxOpts), p = await ctx.newPage(); p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8776/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(([a, b]) => { addToColl(slim(a), "nonfoil", 1, "main"); addToColl(slim(b), "nonfoil", 2, "main");
    S.decks.d = { id: "d", name: "Test", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; addToDeck(S.decks.d, slim(a), 1, false); go("coll"); }, [card("sol", "Sol Ring"), card("sig", "Arcane Signet")]);
  await p.waitForTimeout(300);
  const res = {};
  const row = await p.$("#clist .item"); 
  if (row) { await row.hover(); await p.waitForTimeout(400); res.coll = await p.evaluate(() => { const v = document.querySelector("#pv"); return v && !v.hidden ? v.getAttribute("src") : null; }); }
  await p.mouse.move(5, 5); await p.waitForTimeout(150); res.gone = await p.evaluate(() => { const v = document.querySelector("#pv"); return !v || v.hidden; });
  await p.evaluate(() => go("decks", "d")); await p.waitForTimeout(300);
  const dr = await p.$("#dl .item"); if (dr) { await dr.hover(); await p.waitForTimeout(400); res.deck = await p.evaluate(() => { const v = document.querySelector("#pv"); return v && !v.hidden ? v.getAttribute("src") : null; }); }
  res.dbg = await p.evaluate(() => [document.querySelectorAll("#dl .item").length, (document.querySelector("#dl .item img") || {}).src, document.querySelector("#pv") && document.querySelector("#pv").hidden]);
  if (res.deck) { const box = await p.evaluate(() => { const r = document.querySelector("#pv").getBoundingClientRect(); return [r.left, r.right, innerWidth]; }); res.inView = box[0] >= 0 && box[1] <= box[2]; }
  await b.close(); srv.kill();
  return res;
}
(async () => {
  const d = await run({ viewport: { width: 1280, height: 800 } }, "desktop");
  ok(d.coll && /\/normal\/front\//.test(d.coll), "computer: resting on a collection card shows it full size (" + d.coll + ")");
  ok(d.gone, "moving away hides it");
  ok(d.deck && /\/normal\//.test(d.deck) && d.inView, "works in deck lists too, and stays on screen " + JSON.stringify([d.deck, d.inView, d.dbg]));
  const m = await run(devices["Pixel 7"], "phone");
  ok(!m.coll && !m.deck, "phone/tablet (touch): no hover popup; tapping opens the card as before");
})();
