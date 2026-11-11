// Collection integrity: adding, removing, moving (whole or part), merging, finish and condition kept, paid averaged,
// a scan added to both a deck and the collection undone from both, and the same card held in view not added twice.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8839", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), p = await (await b.newContext({ viewport: { width: 412, height: 900 } })).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8839/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(() => {
    const card = (id, name, fins = ["nonfoil", "foil"]) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "2", usd_foil: "5" }, finishes: fins });
    S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade" } }; S.coll = {}; S.decks = {};
    const all = () => Object.values(S.coll).map(e => `${e.name}|${e.finish}|${e.binder}|${e.cond || "NM"}|${e.qty}${e.paid != null ? "|$" + e.paid : ""}`).sort();
    const o = {}, sol = card("sol", "Sol Ring"), bolt = card("bolt", "Lightning Bolt"), helix = card("helix", "Lightning Helix", ["nonfoil"]);
    const k = addToColl(sol, "nonfoil", 3, "main"); o.add3 = S.coll[k].qty;
    addToColl(sol, "nonfoil", -1, "main"); o.remove1 = S.coll[k].qty;
    addToColl(sol, "nonfoil", -2, "main"); o.removeLast = k in S.coll;
    addToColl(sol, "nonfoil", -1, "main"); o.removeMissing = all();
    // move whole entries
    const k2 = addToColl(sol, "nonfoil", 2, "main"); moveEntry(k2, "trade"); o.move = all();
    const k3 = addToColl(sol, "nonfoil", 3, "main"); moveEntry(k3, "trade"); o.merge = all();
    S.coll = {}; const kf = addToColl(bolt, "foil", 2, "main"); moveEntry(kf, "trade"); o.foil = all();
    S.coll = {}; const kl = addToColl(bolt, "nonfoil", 1, "main", false, { cond: "LP" }); moveEntry(kl, "trade"); o.cond = all();
    // conditions and finishes stay separate
    S.coll = {}; addToColl(bolt, "nonfoil", 1, "main"); addToColl(bolt, "nonfoil", 1, "main", false, { cond: "LP" }); addToColl(bolt, "foil", 1, "main"); addToColl(bolt, "etched", 1, "main"); o.separate = all();
    // a finish the card doesn't have falls back to one it has
    S.coll = {}; addToColl(helix, "foil", 1, "main"); o.noFoil = all();
    // paid: averaged per copy
    S.coll = {}; addToColl(sol, "nonfoil", 1, "main", false, { paid: 1 }); addToColl(sol, "nonfoil", 3, "main", false, { paid: 3 }); o.paid = all();
    // part of an entry moved: the rest stays, condition and paid go with it, lands on a matching entry
    S.coll = {}; const kp = addToColl(bolt, "nonfoil", 5, "main", false, { cond: "MP", paid: 2 }); addToColl(bolt, "nonfoil", 1, "trade", false, { cond: "MP" });
    takeCopies(kp, 2, { binder: "trade" }); o.part = all();
    // moving onto an entry with its own price: averaged per copy
    S.coll = {}; const ka = addToColl(sol, "nonfoil", 1, "main", false, { paid: 4 }); addToColl(sol, "nonfoil", 3, "trade", false, { paid: 2 }); moveEntry(ka, "trade"); o.paidMerge = all();
    o.total = 6;
    return o;
  });
  // a scan added to a deck and the collection, then undone from the scan list
  await p.evaluate(() => { S.coll = {}; S.decks = { d: { id: "d", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 } };
    const sol = { id: "sol", oid: "osol", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "uncommon", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "2" }, finishes: ["nonfoil"] };
    addToColl(sol, "nonfoil", 1, "main"); addToDeck(S.decks.d, sol, 1, false, true);
    S.meta.scanDeck = "d"; S.meta.scanDeckColl = true; save(); go("scan"); stopAuto();
    const it = { id: "i1", state: "review", card: sol, finish: "nonfoil", qty: 2, at: Date.now() }; sc.items = [it]; addItem(it, 2); save(); drawSession(); });
  const state = () => p.evaluate(() => [Object.values(S.coll).map(e => e.name + "×" + e.qty + " scans " + (e.scans || 0)).join(), Object.values(S.decks.d.cards).map(c => c.name + "×" + c.qty).join()]);
  R.scanned = await state();
  await p.click('[data-undo="i1"]'); await p.waitForTimeout(100);
  R.undone = await state(); R.itemBack = await p.evaluate(() => sc.items[0].state);
  // the same card held in view after it's read is not added again; a different card is
  await p.waitForFunction(() => $("#vid") && $("#vid").videoWidth > 0, null, { timeout: 8000 });
  R.repeat = await p.evaluate(async () => {
    S.meta.scanDeck = null; save(); stopAuto(); sc.auto = true; sc.items = []; Object.assign(ana, { armed: true, fails: 0, empties: 0, cool: 0, since: 0, prev: null, sig: null, failMsg: "", readySince: 0, unlockSince: 0, seenAt: 0, lostAt: 0 });
    let pic = 1; const frame = n => { const L = new Float32Array(144 * 200); for (let i = 0; i < L.length; i++) L[i] = 60 + ((i * n) % 97); return L; };
    sampleCard = () => ({ L: frame(pic), std: 40, text: 50, sharp: 3, mean: 120 });
    det.box = { x: 100, y: 100, w: 400, h: 560, a: 0 }; det.seen = performance.now() + 1e9; det.moved = 0;
    let adds = 0; grabShot = async () => ({ c: document.createElement("canvas"), src: "snapshot", res: "1x1" });
    captureFrom = async () => { adds++; sc.lastRead = "Sol Ring"; return true; };
    const run = async ms => { const end = performance.now() + ms; while (performance.now() < end) { autoTick(); await new Promise(r => setTimeout(r, 60)); } };
    await run(3000); const same = adds;
    pic = 7; await run(600); pic = 13; for (let i = 0; i < 12 && adds < 2; i++) await run(500);
    return [same, adds];
  });
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  ok(R.add3 === 3 && R.remove1 === 2 && R.removeLast === false, "add 3 → 3; remove 1 → 2; remove the last ones → the entry is gone");
  ok(R.removeMissing.length === 0, "removing a card that isn't there doesn't make a negative entry");
  ok(JSON.stringify(R.move) === '["Sol Ring|nonfoil|trade|NM|2"]', "moving to another binder keeps the quantity " + R.move);
  ok(JSON.stringify(R.merge) === '["Sol Ring|nonfoil|trade|NM|5"]', "moving onto the same card in that binder merges the quantities " + R.merge);
  ok(JSON.stringify(R.foil) === '["Lightning Bolt|foil|trade|NM|2"]', "a foil stays foil when moved " + R.foil);
  ok(JSON.stringify(R.cond) === '["Lightning Bolt|nonfoil|trade|LP|1"]', "a damaged card keeps its condition when moved " + R.cond);
  ok(R.separate.length === 3 && R.separate.includes("Lightning Bolt|nonfoil|main|LP|1") && R.separate.includes("Lightning Bolt|foil|main|NM|1") && R.separate.includes("Lightning Bolt|nonfoil|main|NM|2"), "conditions and finishes stay separate (etched, which this printing doesn't have, falls back to normal) " + R.separate);
  ok(JSON.stringify(R.noFoil) === '["Lightning Helix|nonfoil|main|NM|1"]', "a finish the printing doesn't have falls back to one it has");
  ok(JSON.stringify(R.paid) === '["Sol Ring|nonfoil|main|NM|4|$2.5"]', "what you paid is averaged per copy " + R.paid);
  ok(R.part.includes("Lightning Bolt|nonfoil|main|MP|3|$2") && R.part.includes("Lightning Bolt|nonfoil|trade|MP|3|$2"), "moving part of an entry: the rest stays, condition and paid go along, it merges, nothing is lost " + R.part);
  ok(JSON.stringify(R.paidMerge) === '["Sol Ring|nonfoil|trade|NM|4|$2.5"]', "moving onto an entry with its own paid price averages them per copy " + R.paidMerge);
  ok(R.scanned[0] === "Sol Ring×3 scans 2" && R.scanned[1] === "Sol Ring×3", "a scan into a deck that also adds to the collection adds to both " + R.scanned);
  ok(R.undone[0] === "Sol Ring×1 scans 0" && R.undone[1] === "Sol Ring×1" && R.itemBack === "review", "undoing it takes it back out of both, copies from before stay " + R.undone);
  ok(R.repeat[0] === 1 && R.repeat[1] === 2, "the same card held in view is read once, not again and again; a new card is read " + R.repeat);
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
