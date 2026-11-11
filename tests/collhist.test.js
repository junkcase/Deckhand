// Copy history when copies move (takeCopies / moveEntry): the scan count is split, never copied, and adds up when
// entries merge (the total never changes); scan dates aren't lost; "New" (newAt) goes with the copies and the later one
// is kept on a merge; "added" keeps the earlier date. Whole and part moves, into a new or an existing entry, and changes
// of condition, finish and printing.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8842", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), p = await (await b.newContext()).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.abort());
  await p.goto("http://127.0.0.1:8842/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(() => {
    const T1 = 1000, T2 = 2000, T3 = 3000, T4 = 4000, T5 = 5000, T9 = 9000;
    const sol = { id: "sol", oid: "osol", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "2", usd_foil: "5" }, finishes: ["nonfoil", "foil"] };
    const sol2 = Object.assign({}, sol, { id: "sol2", set: "c21", num: "263" });
    S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade" } };
    // an entry with history: 4 copies, 3 of them scanned, first scanned at T1, last at T3, added T1, New since T3
    const make = (bnd = "main", h = {}) => { const k = addToColl(sol, "nonfoil", h.qty || 4, bnd); Object.assign(S.coll[k], { added: T1, newAt: T3, scanned: T3, firstScanned: T1, scans: 3 }, h.over || {}); delete S.coll[k].qtyX; return k; };
    const hist = e => e ? { qty: e.qty, scans: e.scans || 0, scanned: e.scanned || 0, first: e.firstScanned || 0, added: e.added || 0, newAt: e.newAt || 0 } : null;
    const total = () => Object.values(S.coll).reduce((a, e) => a + (e.scans || 0), 0);
    const o = {};
    // 1. whole entry into a new entry (another binder)
    S.coll = {}; let k = make(); let nk = takeCopies(k, 4, { binder: "trade" }); o.wholeNew = [hist(S.coll[k]), hist(S.coll[nk]), total()];
    // 2. whole entry into an existing entry (2 copies, 1 scanned at T5, first scanned T2, added T2, New at T2)
    S.coll = {}; k = make(); let tk = make("trade", { qty: 2, over: { added: T2, newAt: T2, scanned: T5, firstScanned: T2, scans: 1 } });
    nk = takeCopies(k, 4, { binder: "trade" }); o.wholeMerge = [hist(S.coll[k]), hist(S.coll[nk]), nk === tk, total()];
    // 3. some copies into a new entry: 2 of 4 (3 scans) → 2 go (round 1.5) , 1 stays
    S.coll = {}; k = make(); nk = takeCopies(k, 2, { binder: "trade" }); o.partNew = [hist(S.coll[k]), hist(S.coll[nk]), total()];
    // 1 of 4 → round(0.75) = 1 scan goes
    S.coll = {}; k = make(); nk = takeCopies(k, 1, { binder: "trade" }); o.partNew1 = [hist(S.coll[k]), hist(S.coll[nk]), total()];
    // 1 of 4 with only 1 scan → round(0.25) = 0: none go, so the moved copy gets no scan dates; the original keeps them
    S.coll = {}; k = make("main", { over: { scans: 1 } }); nk = takeCopies(k, 1, { binder: "trade" }); o.partNoScan = [hist(S.coll[k]), hist(S.coll[nk]), total()];
    // 4. some copies into an existing entry: 2 of 4 into trade (which has 2, 1 scan, newer New)
    S.coll = {}; k = make(); tk = make("trade", { qty: 2, over: { added: T2, newAt: T9, scanned: T2, firstScanned: T2, scans: 1 } });
    nk = takeCopies(k, 2, { binder: "trade" }); o.partMerge = [hist(S.coll[k]), hist(S.coll[nk]), nk === tk, total()];
    // condition, finish and printing changes go the same way
    S.coll = {}; k = make(); nk = takeCopies(k, 2, { cond: "LP" }); o.cond = [hist(S.coll[k]), hist(S.coll[nk]), S.coll[nk].cond, total()];
    S.coll = {}; k = make(); nk = takeCopies(k, 4, { finish: "foil" }); o.finish = [hist(S.coll[k]), hist(S.coll[nk]), S.coll[nk].finish, total()];
    S.coll = {}; k = make(); nk = takeCopies(k, 2, { card: sol2 }); o.printing = [hist(S.coll[k]), hist(S.coll[nk]), S.coll[nk].set, total()];
    // an older entry with scan dates but no scan count: the dates go with the copies (no way to tell which were scanned)
    S.coll = {}; k = make("main", { over: { scans: undefined } }); delete S.coll[k].scans; nk = takeCopies(k, 1, { binder: "trade" }); o.legacy = [hist(S.coll[k]), hist(S.coll[nk])];
    // moveEntry (the whole entry to another binder) into an existing entry: same merge
    S.coll = {}; k = make(); tk = make("trade", { qty: 2, over: { added: T2, newAt: T4, scanned: T5, firstScanned: T2, scans: 1 } });
    moveEntry(k, "trade"); o.moveEntry = [hist(S.coll[k]), hist(S.coll[tk]), total()];
    // the "New" mark shows for copies that were new when moved
    S.coll = {}; k = make("main", { over: { newAt: Date.now() } }); nk = takeCopies(k, 1, { binder: "trade" }); o.isNew = [isNewRow(S.coll[nk]), isNewRow(S.coll[k])];
    // paid still averages, moving nothing (same key) changes nothing
    S.coll = {}; k = make(); const same = takeCopies(k, 2, {}); o.same = [same === k, hist(S.coll[k])];
    return o;
  });
  // ---- more cases
  const X = await p.evaluate(() => {
    const sol = { id: "sol", oid: "osol", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "2", usd_foil: "5" }, finishes: ["nonfoil", "foil"] };
    S.binders = { main: { id: "main", name: "Collection" }, trade: { id: "trade", name: "Trade" }, b3: { id: "b3", name: "Box 3" } };
    const total = () => Object.values(S.coll).reduce((a, e) => a + (e.scans || 0), 0), qty = () => Object.values(S.coll).reduce((a, e) => a + e.qty, 0);
    const where = () => Object.values(S.coll).map(e => `${e.binder}|${e.finish}|${e.cond || "NM"}|${e.qty}|s${e.scans || 0}`).sort().join(" ");
    const bad = () => Object.values(S.coll).some(e => ["scanned", "firstScanned", "added", "newAt", "scans"].some(f => f in e && !(typeof e[f] === "number" && isFinite(e[f]) && e[f] >= 0)) || !(e.qty > 0));
    const o = {};
    // 1. scan undo after moving some of the scanned copies
    const undoAfter = (pre, move) => {
      S.coll = {}; if (pre) addToColl(sol, "nonfoil", pre, "main");
      S.meta.scanDeck = null; save(); go("scan"); stopAuto();
      const it = { id: "u1", state: "review", card: sol, finish: "nonfoil", qty: 3, at: Date.now() }; sc.items = [it]; addItem(it, 3); save(); drawSession();
      const k = Object.keys(S.coll).find(k => S.coll[k].binder === "main"); const after = where();
      if (move) takeCopies(k, move, { binder: "trade" }); const moved = where(), toasts = [];
      const t0 = toast; toast = m => toasts.push(m); document.querySelector('[data-undo="u1"]').click(); toast = t0;
      return { after, moved, undone: where(), qty: qty(), bad: bad(), toast: toasts[0], item: sc.items[0].state };
    };
    o.undoNoMove = undoAfter(1, 0);
    o.undoMoved1 = undoAfter(0, 1);
    o.undoMovedPre = undoAfter(1, 2);
    // 2. the same entry split across several places, one move at a time: the scan total never changes
    S.coll = {}; let k = addToColl(sol, "nonfoil", 10, "main"); Object.assign(S.coll[k], { scans: 7, scanned: 3000, firstScanned: 1000, added: 1000, newAt: 3000 });
    const sums = [total()];
    takeCopies(k, 3, { binder: "trade" }); sums.push(total());
    takeCopies(k, 2, { binder: "b3" }); sums.push(total());
    takeCopies(k, 1, { cond: "LP" }); sums.push(total());
    takeCopies(k, 2, { finish: "foil" }); sums.push(total());
    const tk = Object.keys(S.coll).find(x => S.coll[x].binder === "trade"); takeCopies(tk, 1, { binder: "b3" }); sums.push(total());
    takeCopies(k, 2, { binder: "trade" }); sums.push(total());
    o.repeat = { sums, where: where(), qty: qty(), bad: bad() };
    // 3. "added": kept on both sides of a part move; a merge keeps the earliest
    S.coll = {}; k = addToColl(sol, "nonfoil", 4, "main"); Object.assign(S.coll[k], { added: 1500 });
    let nk = takeCopies(k, 1, { binder: "trade" }); o.addedPart = [S.coll[k].added, S.coll[nk].added];
    const t2 = addToColl(sol, "nonfoil", 1, "b3"); S.coll[t2].added = 900; takeCopies(k, 1, { binder: "b3" }); const t3 = addToColl(sol, "foil", 1, "main"); S.coll[t3].added = 5000; takeCopies(k, 1, { finish: "foil" });
    o.addedMerge = [S.coll[t2].added, S.coll[t3].added];
    // 4. older entries with no dates at all: nothing invented, nothing reset, nothing invalid
    S.coll = {}; k = addToColl(sol, "nonfoil", 3, "main"); for (const f of ["scanned", "firstScanned", "added", "newAt", "scans"]) delete S.coll[k][f];
    nk = takeCopies(k, 1, { binder: "trade" }); takeCopies(k, 1, { binder: "trade" });
    o.legacy = [Object.keys(S.coll[k]).filter(f => ["scanned", "firstScanned", "added", "newAt", "scans"].includes(f)), Object.keys(S.coll[nk]).filter(f => ["scanned", "firstScanned", "added", "newAt", "scans"].includes(f)), bad()];
    // …merged into an entry that has dates: its dates stay
    const dk = addToColl(sol, "nonfoil", 1, "b3"); Object.assign(S.coll[dk], { added: 2000, newAt: 2500, scanned: 2400, firstScanned: 2100, scans: 1 });
    takeCopies(nk, 2, { binder: "b3" }); o.legacyIntoDated = [S.coll[dk].added, S.coll[dk].newAt, S.coll[dk].scanned, S.coll[dk].firstScanned, S.coll[dk].scans, S.coll[dk].qty, bad()];
    // 5. a scan count of 0: no scan history appears
    S.coll = {}; k = addToColl(sol, "nonfoil", 3, "main"); Object.assign(S.coll[k], { scans: 0 }); delete S.coll[k].scanned; delete S.coll[k].firstScanned;
    nk = takeCopies(k, 1, { binder: "trade" }); const whole = takeCopies(k, 2, { binder: "b3" });
    o.zero = [S.coll[nk].scans, "scanned" in S.coll[nk], S.coll[whole].scans, "scanned" in S.coll[whole], total(), bad()];
    // …0 scans but scan dates (every scan undone): a part move doesn't hand out dates for scans that aren't there; a whole move keeps them
    S.coll = {}; k = addToColl(sol, "nonfoil", 3, "main"); Object.assign(S.coll[k], { scans: 0, scanned: 3000, firstScanned: 1000 });
    nk = takeCopies(k, 1, { binder: "trade" }); const w2 = takeCopies(k, 2, { binder: "b3" });
    o.zeroDates = ["scanned" in S.coll[nk], S.coll[w2].scanned, S.coll[w2].firstScanned, total()];
    // 6. more scans than copies (some removed by hand): shared out by the same rule, total kept
    S.coll = {}; k = addToColl(sol, "nonfoil", 2, "main"); Object.assign(S.coll[k], { scans: 5, scanned: 3000, firstScanned: 1000 });
    nk = takeCopies(k, 1, { binder: "trade" }); o.over = [S.coll[k].scans, S.coll[nk].scans, total()];
    const m2 = addToColl(sol, "nonfoil", 1, "b3"); S.coll[m2].scans = 4; takeCopies(k, 1, { binder: "b3" }); o.overMerge = [k in S.coll, S.coll[m2].scans, S.coll[m2].qty, total(), bad()];
    return o;
  });
  R.X = X;
  console.log(JSON.stringify(R));
  const H = (q, scans, scanned, first, added, newAt) => JSON.stringify({ qty: q, scans, scanned, first, added, newAt });
  const J = JSON.stringify;
  ok(R.wholeNew[0] === null && J(R.wholeNew[1]) === H(4, 3, 3000, 1000, 1000, 3000) && R.wholeNew[2] === 3, "whole entry → new entry: all history goes with it " + J(R.wholeNew));
  ok(R.wholeMerge[0] === null && R.wholeMerge[2] && J(R.wholeMerge[1]) === H(6, 4, 5000, 1000, 1000, 3000) && R.wholeMerge[3] === 4, "whole entry → existing entry: scans add up (3+1), latest last-scan, earliest first-scan and added, later New " + J(R.wholeMerge));
  ok(J(R.partNew[0]) === H(2, 1, 3000, 1000, 1000, 3000) && J(R.partNew[1]) === H(2, 2, 3000, 1000, 1000, 3000) && R.partNew[2] === 3, "2 of 4 → new entry: the scan count is split (2 go, 1 stays), not copied; total stays 3 " + J(R.partNew));
  ok(J(R.partNew1[0]) === H(3, 2, 3000, 1000, 1000, 3000) && J(R.partNew1[1]) === H(1, 1, 3000, 1000, 1000, 3000) && R.partNew1[2] === 3, "1 of 4 → new entry: 1 scan goes, 2 stay " + J(R.partNew1));
  ok(J(R.partNoScan[0]) === H(3, 1, 3000, 1000, 1000, 3000) && J(R.partNoScan[1]) === H(1, 0, 0, 0, 1000, 3000) && R.partNoScan[2] === 1, "1 of 4 with 1 scan: the scan stays with the original (and its dates); the moved copy keeps added and New " + J(R.partNoScan));
  ok(J(R.partMerge[0]) === H(2, 1, 3000, 1000, 1000, 3000) && R.partMerge[2] && J(R.partMerge[1]) === H(4, 3, 3000, 1000, 1000, 9000) && R.partMerge[3] === 4, "2 of 4 → existing entry: scans 1+2 there, 1 left here, total 4 kept; the later New (9000) stays " + J(R.partMerge));
  ok(R.cond[2] === "LP" && J(R.cond[0]) === H(2, 1, 3000, 1000, 1000, 3000) && J(R.cond[1]) === H(2, 2, 3000, 1000, 1000, 3000) && R.cond[3] === 3, "changing the condition of some copies: same rules " + J(R.cond));
  ok(R.finish[2] === "foil" && R.finish[0] === null && J(R.finish[1]) === H(4, 3, 3000, 1000, 1000, 3000) && R.finish[3] === 3, "changing the finish of all copies: same rules " + J(R.finish));
  ok(R.printing[2] === "c21" && J(R.printing[1]) === H(2, 2, 3000, 1000, 1000, 3000) && R.printing[3] === 3, "changing the printing of some copies: history goes with them " + J(R.printing));
  ok(J(R.legacy[0]) === H(3, 0, 3000, 1000, 1000, 3000) && J(R.legacy[1]) === H(1, 0, 3000, 1000, 1000, 3000), "older entries with no scan count: the scan dates aren't lost " + J(R.legacy));
  ok(R.moveEntry[0] === null && J(R.moveEntry[1]) === H(6, 4, 5000, 1000, 1000, 4000) && R.moveEntry[2] === 4, "moving a whole entry to another binder merges the same way (and keeps the later New) " + J(R.moveEntry));
  ok(R.isNew[0] === true && R.isNew[1] === true, "copies still marked New after moving");
  ok(R.same[0] && J(R.same[1]) === H(4, 3, 3000, 1000, 1000, 3000), "a move to the same place changes nothing");
  const U = X.undoNoMove, U1 = X.undoMoved1, U2 = X.undoMovedPre;
  ok(U.after === "main|nonfoil|NM|4|s3" && U.undone === "main|nonfoil|NM|1|s0" && U.toast === "Taken back out" && U.item === "review", "scan undo, nothing moved: takes the 3 back, the copy from before stays " + J(U));
  ok(U1.moved === "main|nonfoil|NM|2|s2 trade|nonfoil|NM|1|s1" && U1.undone === "trade|nonfoil|NM|1|s1" && U1.qty === 1 && !U1.bad && /except 1 that was moved or removed since/.test(U1.toast), "scan undo after 1 of the 3 moved: takes back the 2 still where the scan put them, leaves the moved one alone and says so " + J(U1));
  ok(U2.moved === "main|nonfoil|NM|2|s1 trade|nonfoil|NM|2|s2" && U2.undone === "trade|nonfoil|NM|2|s2" && U2.qty === 2 && !U2.bad && /except 1 that was moved/.test(U2.toast), "scan undo after a move, with a copy from before: never goes below zero or touches the other binder; nothing invalid " + J(U2));
  ok(X.repeat.sums.every(x => x === 7) && X.repeat.qty === 10 && !X.repeat.bad, "the same entry split 6 times across binders, a condition and a finish: the scan total stays 7 every time " + J(X.repeat));
  ok(J(X.addedPart) === "[1500,1500]" && J(X.addedMerge) === "[900,1500]", "added: kept on both the original and the moved copies; a merge keeps the earlier date " + J([X.addedPart, X.addedMerge]));
  ok(J(X.legacy[0]) === "[]" && J(X.legacy[1]) === "[]" && !X.legacy[2], "entries with no dates or scan count: moving and merging adds none, no invalid values " + J(X.legacy));
  ok(J(X.legacyIntoDated) === "[2000,2500,2400,2100,1,3,false]", "an undated entry merged into a dated one: the dates and scan count there stay as they were " + J(X.legacyIntoDated));
  ok(X.zero[0] === undefined && !X.zero[1] && X.zero[2] === undefined && !X.zero[3] && X.zero[4] === 0 && !X.zero[5], "a scan count of 0: moving invents no scans or scan dates " + J(X.zero));
  ok(X.zeroDates[0] === false && X.zeroDates[1] === 3000 && X.zeroDates[2] === 1000 && X.zeroDates[3] === 0, "0 scans with old scan dates: a part move doesn't hand them out; the whole entry keeps them " + J(X.zeroDates));
  ok(J(X.over) === "[2,3,5]" && J(X.overMerge) === "[false,6,2,9]".replace("]", ",false]"), "more scans than copies (5 scans, 2 copies): 1 copy moved takes 3, 2 stay, total 5; merging adds up (2+4=6, total 9) " + J([X.over, X.overMerge]));
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
