// Decks list: a Commander deck shows its commander's card image (both, for partners); other decks are unchanged.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const fs = require("fs"), path = require("path");
// a small real picture, so the layout is measured with an image that loads
const JPG = fs.readFileSync(path.join(__dirname, "..", "images", "welcome-800.jpg"));
async function run(opts, label, shot) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => /broken/.test(r.request().url()) ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, contentType: "image/jpeg", body: JPG }));
  await p.route(u => /^https:/.test(u.href) && u.hostname !== "cards.scryfall.io", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8896/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => {
    const mk = (id, name, type, qty = 1) => ({ id, name, type, cmc: 3, qty, set: "x", num: "1", img: `https://cards.scryfall.io/small/front/a/b/${id}.jpg`, prices: { usd: "1" }, finishes: ["nonfoil"], leg: { commander: "l" }, roles: [], ci: ["G"], colors: ["G"] });
    const deck = (id, name, format, cmdrs, extra = [], t = 1) => { const cards = {}; for (const c of [...cmdrs, ...extra, mk("f-" + id, "Forest", "Basic Land — Forest", 30)]) cards[c.id + "|0"] = c; S.decks[id] = { id, name, format, cmdr: cmdrs.map(c => c.id + "|0"), cards, created: 1, updated: t }; };
    deck("one", "Atraxa Superfriends with a rather long deck name to wrap", "commander", [mk("atraxa", "Atraxa, Praetors' Voice", "Legendary Creature")], [], 5);
    deck("two", "Partners", "commander", [mk("tymna", "Tymna the Weaver", "Legendary Creature"), mk("thrasios", "Thrasios, Triton Hero", "Legendary Creature")], [], 4);
    deck("none", "No commander yet", "commander", [], [], 3);
    deck("mod", "Modern Burn", "modern", [], [mk("bolt", "Lightning Bolt", "Instant", 4)], 2);
    deck("bad", "Picture missing", "commander", [mk("broken", "Broken Image", "Legendary Creature")], [], 1);
    save(); go("decks");
  });
  await p.waitForTimeout(900);
  const info = await p.evaluate(() => [...document.querySelectorAll(".deck-card")].map(b => ({ id: b.dataset.d, imgs: [...b.querySelectorAll(".dc-cmdr img")].map(i => ({ alt: i.alt, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), ok: i.complete && i.naturalWidth > 0 })), wrap: !!b.querySelector(".dc-cmdr"),
    title: b.querySelector("h3").textContent, w: Math.round(b.getBoundingClientRect().width), over: b.scrollWidth > b.clientWidth + 1, pips: b.querySelectorAll(".pip").length })));
  const by = Object.fromEntries(info.map(x => [x.id, x]));
  ok(by.one.imgs.length === 1 && by.one.imgs[0].alt === "Atraxa, Praetors' Voice" && by.one.imgs[0].ok, `${label}: a Commander deck shows its commander's card`);
  ok(by.one.imgs[0].w >= 50 && by.one.imgs[0].w <= 70 && Math.abs(by.one.imgs[0].h / by.one.imgs[0].w - 1.4) < 0.05, `${label}: at card shape and a readable size (${by.one.imgs[0].w}×${by.one.imgs[0].h})`);
  ok(by.two.imgs.length === 2 && by.two.imgs.map(i => i.alt).join("|") === "Tymna the Weaver|Thrasios, Triton Hero", `${label}: partners show both commanders`);
  ok(by.none.imgs.length === 0 && !by.none.wrap, `${label}: a Commander deck with no commander chosen shows no picture`);
  ok(by.mod.imgs.length === 0 && !by.mod.wrap, `${label}: a deck in another format is unchanged`);
  ok(by.bad.imgs.length === 0, `${label}: a picture that fails to load is taken away rather than left broken`);
  ok(info.every(x => !x.over) && await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: nothing runs off the side of the screen`);
  ok(info.every(x => x.title.length > 0) && by.one.pips > 0, `${label}: name and colors are still shown`);
  if (shot) await p.screenshot({ path: path.join(__dirname, shot) });
  await p.click('.deck-card[data-d="two"] .dc-cmdr img'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => deckOpen) === "two", `${label}: tapping the picture opens the deck like the rest of the row`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8896", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1100, height: 900 } }, "computer", "deckcmdr_pc.png"); await run({ ...devices["Pixel 7"] }, "phone", "deckcmdr_phone.png"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
