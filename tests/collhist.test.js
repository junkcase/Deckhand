// Copy history when copies move (takeCopies / moveEntry): the scan count is split, never copied, and adds up when
// entries merge (the total never changes); scan dates aren't lost; "New" (newAt) goes with the copies and the later one
// is kept on a merge; "added" keeps the earlier date. Whole and part moves, into a new or an existing entry, and changes
// of condition, finish and printing.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8842", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext()).newPage(), errs = [];
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
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
