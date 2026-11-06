// Card sounds: a tune by price when a card is scanned or added, "check this one" and "couldn't find it" cues,
// one sound per photo of several cards, the on/off setting, and the notes really being scheduled.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// a stand-in for the browser's audio, recording every note scheduled
const FAKE_AUDIO = () => {
  window.__osc = [];
  class P { constructor(v) { this.value = v; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new RangeError("exponential ramp to " + v); } setTargetAtTime() {} cancelScheduledValues() {} }
  class N { connect() {} disconnect() {} }
  class AC { constructor() { this.state = "running"; this.currentTime = 0; this.destination = new N(); }
    resume() { return Promise.resolve(); }
    createGain() { const g = new N(); g.gain = new P(1); return g; }
    createOscillator() { const o = new N(); o.frequency = new P(440); o.start = t => __osc.push({ f: o.frequency.value, t, type: o.type }); o.stop = () => {}; return o; } }
  window.AudioContext = AC; window.webkitAudioContext = AC;
};
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8799", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  await ctx.addInitScript(FAKE_AUDIO);
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script|Permission|NotAllowed|NotFound|camera/i.test(m.text())) errs.push(m.text()); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8799/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  await p.evaluate(() => {
    S.binders = { main: { id: "main", name: "Collection" }, wish: { id: "wish", name: "Wishlist", wish: true } }; S.meta.binder = "main"; save();
    window.__played = []; const real = playSound; playSound = k => { __played.push(k); real(k); };
    window.mk = (id, usd, usdFoil) => ({ id, oid: "o" + id, name: "Card " + id, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", imgN: "",
      prices: { usd: usd == null ? null : String(usd), usd_foil: usdFoil == null ? null : String(usdFoil) }, finishes: ["nonfoil", "foil"], leg: {} });
  });
  const played = () => p.evaluate(() => __played.splice(0));
  // price ranges, including the edges
  R.tiers = await p.evaluate(() => [null, 0.5, 0.99, 1, 4.99, 5, 19.99, 20, 99.99, 100, 2500].map(priceSound));
  R.items = await p.evaluate(() => [itemSound({ state: "failed" }), itemSound({ state: "pick" }), itemSound({ state: "review", conf: "medium", card: mk("a", 50), finish: "nonfoil" }),
    itemSound({ state: "review", conf: "high", card: mk("b", 3, 30), finish: "foil" }), itemSound({ state: "review", conf: "high", card: mk("c", 3, 30), finish: "nonfoil" })]);
  // the notes are really scheduled: the cheap tune is 5 notes (two tones each), A4 = 440 Hz first
  await p.evaluate(() => { __osc.length = 0; playSound("cheap"); }); R.osc = await p.evaluate(() => __osc.map(o => Math.round(o.f)));
  await p.evaluate(() => { __osc.length = 0; for (const k of Object.keys(SOUNDS)) playSound(k); }); R.allNotes = await p.evaluate(() => __osc.length / 2); R.expected = await p.evaluate(() => Object.values(SOUNDS).reduce((a, n) => a + n.length, 0));
  await played();
  // scanner: a confident match plays its price; an unsure one "check"; a list of choices "check"
  await p.evaluate(() => { go("scan"); }); await p.waitForTimeout(400);
  await p.evaluate(() => { setMatch(mk("s1", 150), true, false, "high"); setMatch(mk("s2", 7), true, false, "high"); setMatch(mk("s3", 7), true, false, "medium"); });
  R.scan = await played();
  // a photo of several cards: only the best sound, once
  await p.evaluate(() => { sndBatch = []; setMatch(mk("g1", 0.3), true, false, "high"); setMatch(mk("g2", 25), true, false, "high"); cardSound("miss"); setMatch(mk("g3", 2), true, false, "high"); endSoundBatch(); });
  R.grid = await played();
  await p.evaluate(() => { sndBatch = []; cardSound("miss"); cardSound("miss"); endSoundBatch(); }); R.gridMiss = await played();
  // the setting and the "hear them" buttons on the scan screen
  R.box = await p.$eval("#scSnd", e => e.textContent.replace(/\s+/g, " "));
  R.on = await p.$eval("#scSounds", e => e.checked);
  await p.click("#scSnd summary"); await p.click('#scSnd [data-snd="jackpot"]'); await p.click('#scSnd [data-snd="miss"]'); R.hear = await played();
  await p.uncheck("#scSounds"); R.saved = await p.evaluate(() => S.meta.cardSounds);
  await p.evaluate(() => { setMatch(mk("q1", 150), true, false, "high"); }); R.off = await played();
  await p.check("#scSounds"); await played();
  // adding by hand from the card screen: the price of the finish chosen; nothing for a wishlist
  await p.evaluate(() => { openCard(mk("h1", 12)); }); await p.waitForTimeout(300); await p.click("#cPlus"); await p.waitForTimeout(100); R.cardAdd = await played();
  await p.click("#cMinus"); await p.waitForTimeout(100); R.remove = await played();
  await p.selectOption("#bSel", "wish"); await p.waitForTimeout(150); R.wishBin = await p.$eval("#bSel", e => e.value);
  await p.click("#cPlus"); await p.waitForTimeout(100); R.wishAdd = await played();
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts);
    ok(JSON.stringify(R.tiers) === JSON.stringify(["cheap", "cheap", "cheap", "less", "less", "moderate", "moderate", "pricey", "pricey", "jackpot", "jackpot"]), `${label}: price ranges under $1 / $1–5 / $5–20 / $20–100 / $100+ ${JSON.stringify(R.tiers)}`);
    ok(JSON.stringify(R.items) === JSON.stringify(["miss", "check", "check", "pricey", "less"]), `${label}: not found → miss, unsure → check, foil uses the foil price ${JSON.stringify(R.items)}`);
    ok(R.osc.length === 10 && R.osc[0] === 440 && R.osc[1] === 880, `${label}: the cheap tune's notes are scheduled (A4 first) ${JSON.stringify(R.osc)}`);
    ok(R.allNotes === R.expected && R.expected === 78, `${label}: every note of all 7 sounds is scheduled (${R.allNotes} of ${R.expected})`);
    ok(JSON.stringify(R.scan) === '["jackpot","moderate","check"]', `${label}: scanner plays the price, or "check" when unsure ${JSON.stringify(R.scan)}`);
    ok(JSON.stringify(R.grid) === '["pricey"]' && JSON.stringify(R.gridMiss) === '["miss"]', `${label}: a photo of several cards plays one sound, the best one ${JSON.stringify([R.grid, R.gridMiss])}`);
    ok(/Card sounds/.test(R.box) && /under \$1/.test(R.box) && /\$100 and up/.test(R.box) && /Couldn't find it/.test(R.box) && R.on, `${label}: setting on by default, with the ranges listed ${R.box}`);
    ok(JSON.stringify(R.hear) === '["jackpot","miss"]', `${label}: "Hear them" buttons play each sound`);
    ok(R.saved === false && R.off.length === 0, `${label}: turned off, nothing plays ${JSON.stringify(R.off)}`);
    ok(JSON.stringify(R.cardAdd) === '["moderate"]' && R.remove.length === 0, `${label}: adding from the card screen plays the price; removing doesn't ${JSON.stringify([R.cardAdd, R.remove])}`);
    ok(R.wishBin === "wish" && R.wishAdd.length === 0, `${label}: adding to a wishlist is silent (${R.wishBin}) ${JSON.stringify(R.wishAdd)}`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
