const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const fakeCards = {
  "11111111-1111-1111-1111-111111111111": { name: "Sol Ring", set: "cmm", collector_number: "410" },
};
function card(o) { const id = o.id || (o.set + "-" + o.collector_number + "-" + o.name).replace(/\W/g, ""); return Object.assign({ id, oracle_id: "o-" + o.name, set_name: "Set " + o.set, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00", usd_foil: "3.00" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal" }, image_uris: { small: "s.jpg", normal: "n.jpg" } }, o); }
const KNOWN = [card({ id: "11111111-1111-1111-1111-111111111111", name: "Sol Ring", set: "cmm", collector_number: "410" }),
  card({ name: "Lightning Bolt", set: "m10", collector_number: "146" }), card({ name: "Lightning Bolt", set: "2x2", collector_number: "117" }),
  card({ name: "Counterspell", set: "mh2", collector_number: "267" }), card({ name: "Atraxa, Praetors' Voice", set: "c16", collector_number: "28", type_line: "Legendary Creature" }),
  card({ name: "Island", set: "fdn", collector_number: "279", type_line: "Basic Land — Island" })];
function resolve(idt) {
  if (idt.id) return KNOWN.find(c => c.id === idt.id);
  if (idt.collector_number) return KNOWN.find(c => c.set === idt.set && c.collector_number === idt.collector_number);
  if (idt.set) return KNOWN.find(c => c.set === idt.set && c.name.toLowerCase() === idt.name.toLowerCase());
  return KNOWN.find(c => c.name.toLowerCase() === idt.name.toLowerCase());
}
async function run(csvText, fileName, target, pick, pre) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://junkcase.github.io/Deckhand/" });
  const w = dom.window;
  w.scrollTo = () => {};
  w.fetch = async (url, opt) => {
    const u = String(url);
    const ok = j => ({ ok: true, status: 200, json: async () => j });
    if (u.endsWith("/cards/collection")) { const ids = JSON.parse(opt.body).identifiers; const data = [], nf = []; ids.forEach(i => { const c = resolve(i); c ? data.push(c) : nf.push(i); }); return ok({ data, not_found: nf }); }
    if (u.endsWith("/sets")) return ok({ data: [{ name: "Magic 2010", code: "m10" }, { name: "Commander 2016", code: "c16" }] });
    if (u.includes("/catalog/card-names")) return ok({ data: KNOWN.map(c => c.name) });
    return { ok: false, status: 404, json: async () => ({ details: "nf" }) };
  };
  const js = fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8");
  w.eval(js + "\n;window.__t={S:()=>S,csvImport,go,ioSheet,addToColl,slim,save};"); if (pre) pre(w);
  const file = { name: fileName, text: async () => csvText };
  await w.__t.csvImport(file, target);
  const $ = s => w.document.querySelector(s);
  if (pick) pick($, w);
  const preview = $("#impBody").textContent.replace(/\s+/g, " ");
  const disabledBefore = $("#impGo").disabled, bad = $("#impBad") ? $("#impBad").textContent.replace(/\s+/g, " ") : "";
  if (pick && pick.after) pick.after($, w);
  if ($("#impGo").disabled) return { S: w.__t.S(), preview, disabledBefore, bad, blocked: true, w };
  $("#impGo").click();
  for (let i = 0; i < 60 && !$("#impDone") && $("#impBody") && !/stopped/.test(($("#impProg") || {}).textContent || ""); i++) await new Promise(r => setTimeout(r, 150));
  return { w, disabledBefore, bad, S: w.__t.S(), preview, result: (($("#impRes") || {}).textContent || ($("#impProg") || {}).textContent || ($("#toastRoot") || {}).textContent || "").replace(/\s+/g, " ").trim() };
}
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const qtyOf = (S, name) => Object.values(S.coll).filter(e => e.name === name).reduce((a, e) => a + e.qty, 0);
(async () => {
  // ---- quantities: valid ones import exactly; problem rows are listed and block the import until fixed or skipped
  const CSV = `Name,Set code,Collector number,Quantity
Sol Ring,cmm,410,4
Counterspell,mh2,267,"1,000"
Lightning Bolt,m10,146,x2
Island,fdn,279,2.5
Lightning Bolt,2x2,117,-3
"Atraxa, Praetors' Voice",c16,28,
Sol Ring,cmm,410,three
Counterspell,mh2,267,0
Island,fdn,279,1.000
Island,fdn,279,"1,00"
`;
  let r = await run(CSV, "mixed.csv", { kind: "coll" });
  ok(r.disabledBefore && r.blocked, "with problem rows and nothing chosen, Import is disabled");
  ok(/1,006 cards in 3 rows/.test(r.preview), "preview counts only the good rows: 4 + 1,000 + 2 " + (r.preview.match(/[\d,]+ cards in \d+ rows/) || [""])[0]);
  ok(/7 rows have a quantity that isn't a whole number of 1 or more/.test(r.bad), "7 rows flagged: " + r.bad.slice(0, 80));
  for (const [raw, why] of [['"2.5"', "not a whole number"], ['"-3"', "negative"], ['""', "no quantity"], ['"three"', "not a number"], ['"0"', "zero"], ['"1.000"', "not a whole number"], ['"1,00"', "not a whole number"]])
    ok(r.bad.includes(raw + why), `${raw} → ${why}`);
  // skip them: only the good rows go in, at their exact quantities
  r = await run(CSV, "mixed.csv", { kind: "coll" }, Object.assign(() => {}, { after: ($, w) => { $("#impSkipBad").checked = true; $("#impSkipBad").dispatchEvent(new w.Event("change")); } }));
  ok(!r.blocked && qtyOf(r.S, "Sol Ring") === 4 && qtyOf(r.S, "Counterspell") === 1000 && qtyOf(r.S, "Lightning Bolt") === 2 && qtyOf(r.S, "Island") === 0 && !Object.values(r.S.coll).some(e => /Atraxa/.test(e.name)), "skipping: Sol Ring 4, Counterspell 1,000, Lightning Bolt 2; nothing from the problem rows");
  // fix one (2.5 → 3 Islands), skip the rest
  r = await run(CSV, "mixed.csv", { kind: "coll" }, Object.assign(() => {}, { after: ($, w) => { const i = $('[data-fix="3"]'); i.value = "3"; i.dispatchEvent(new w.Event("change")); $("#impSkipBad").checked = true; $("#impSkipBad").dispatchEvent(new w.Event("change")); } }));
  ok(qtyOf(r.S, "Island") === 3 && qtyOf(r.S, "Sol Ring") === 4, "a corrected quantity is used (Island row fixed to 3)");
  // fix every problem row: no need to skip
  r = await run(CSV, "mixed.csv", { kind: "coll" }, Object.assign(() => {}, { after: ($, w) => { for (const i of [...w.document.querySelectorAll("[data-fix]")]) { i.value = "1"; i.dispatchEvent(new w.Event("change")); } } }));
  ok(!r.blocked && qtyOf(r.S, "Island") === 3 && qtyOf(r.S, "Sol Ring") === 5, "all problem rows corrected: imports without skipping");
  // a typed fix that's itself wrong isn't accepted
  r = await run(CSV, "mixed.csv", { kind: "coll" }, Object.assign(() => {}, { after: ($, w) => { const i = $('[data-fix="3"]'); i.value = "1.5"; i.dispatchEvent(new w.Event("change")); } }));
  ok(r.blocked && /7 rows have/.test(r.w.document.querySelector("#impBad").textContent), "a correction of 1.5 isn't accepted; still blocked");
  // no quantity column: one of each, as before
  r = await run(`Name,Set code,Collector number\nSol Ring,cmm,410\nCounterspell,mh2,267\n`, "noqty.csv", { kind: "coll" });
  ok(!r.blocked && qtyOf(r.S, "Sol Ring") === 1 && qtyOf(r.S, "Counterspell") === 1, "a file with no quantity column: one of each (unchanged)");
  // malformed comma grouping and partial matches: the whole value must be a quantity, digits are never picked out
  r = await run(`Name,Set code,Collector number,Quantity
Sol Ring,cmm,410,"1,00"
Sol Ring,cmm,410,"1,000,0000"
Sol Ring,cmm,410,"1,,000"
Sol Ring,cmm,410,4abc
Sol Ring,cmm,410,4 5
Sol Ring,cmm,410,+4
Sol Ring,cmm,410,"12,345"
`, "commas.csv", { kind: "coll" });
  ok(/6 rows have a quantity/.test(r.bad) && ['"1,00"', '"1,000,0000"', '"1,,000"', '"4abc"', '"4 5"', '"+4"'].every(v => r.bad.includes(v)) && /12,345 cards in 1 rows/.test(r.preview), "1,00 · 1,000,0000 · 1,,000 · 4abc · 4 5 · +4 are flagged; 12,345 is read as 12,345 " + (r.preview.match(/[\d,]+ cards in \d+ rows/) || [""])[0]);
  // the preview's count follows corrections and skipping as they happen
  r = await run(CSV, "mixed.csv", { kind: "coll" }, Object.assign(() => {}, { after: ($, w) => {
    const count = () => ($("#impBody").textContent.match(/([\d,]+) cards in (\d+) rows/) || []).slice(1).join("/"), btn = () => $("#impGo").textContent.replace(/\s+/g, " ").trim();
    w.__live = [count()];
    const i = $('[data-fix="3"]'); i.value = "3"; i.dispatchEvent(new w.Event("change")); w.__live.push(count());
    $("#impSkipBad").checked = true; $("#impSkipBad").dispatchEvent(new w.Event("change")); w.__live.push(count(), btn(), $("#impGo").disabled);
    $("#impSkipBad").checked = false; $("#impSkipBad").dispatchEvent(new w.Event("change")); w.__live.push(count(), $("#impGo").disabled, ($("#impBad").textContent.match(/(\d+) rows have/) || [])[1]);
    $("#impSkipBad").checked = true; $("#impSkipBad").dispatchEvent(new w.Event("change"));
  } }));
  const L = r.w.__live;
  ok(L[0] === "1,006/3" && L[1] === "1,009/4" && L[2] === "1,009/4" && /Import 1,009 cards/.test(L[3]) && L[4] === false, "live count: 1,006 in 3 rows → 1,009 in 4 after a fix; skipping enables Import 1,009 cards " + JSON.stringify(L.slice(0, 5)));
  ok(L[5] === "1,009/4" && L[6] === true && L[7] === "6", "un-ticking skip blocks again and the other 6 problem rows are back, unchanged " + JSON.stringify(L.slice(5)));
  // skipping doesn't change the file or the other rows: the good rows import at exactly their own values
  ok(qtyOf(r.S, "Sol Ring") === 4 && qtyOf(r.S, "Counterspell") === 1000 && qtyOf(r.S, "Lightning Bolt") === 2 && qtyOf(r.S, "Island") === 3, "after fixing one and skipping the rest: every other row imported exactly as written");
  // a plain text deck list: unchanged
  r = await run(`4 Lightning Bolt (M10) 146\n1 Sol Ring\n`, "deck.txt", { kind: "deck", id: "__new" });
  const dk = Object.values(r.S.decks)[0];
  ok(!r.blocked && dk && Object.values(dk.cards).reduce((a, c) => a + c.qty, 0) === 5, "a plain text deck list imports as before");

  // ---- dates from a Deckhand export
  const D = `Name,Set code,Collector number,Foil,Quantity,Condition,Date added,Last scanned,First scanned
Sol Ring,cmm,410,normal,1,NM,2025-03-04 10:20,2025-06-01 08:00,2025-03-04 10:21
Counterspell,mh2,267,normal,1,NM,2025-03-04T10:20:00Z,2025-03-05,
Lightning Bolt,m10,146,normal,1,NM,03/04/2025,2025-02-30 10:00,2099-01-01 00:00
Island,fdn,279,normal,1,NM,,,
`;
  r = await run(D, "deckhand-collection.csv", { kind: "coll" });
  const E = n => Object.values(r.S.coll).find(e => e.name === n), U = (y, mo, d, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);
  const sol = E("Sol Ring"), cs = E("Counterspell"), lb = E("Lightning Bolt"), is = E("Island");
  ok(sol.added === U(2025, 3, 4, 10, 20) && sol.scanned === U(2025, 6, 1, 8) && sol.firstScanned === U(2025, 3, 4, 10, 21), "Deckhand's own format (UTC) restored exactly");
  ok(cs.added === U(2025, 3, 4, 10, 20) && cs.scanned === U(2025, 3, 5) && !("firstScanned" in cs), "full ISO and date-only accepted; empty left unset");
  ok(lb.added > Date.now() - 60e3 && !("scanned" in lb) && !("firstScanned" in lb), "03/04/2025 (ambiguous), 31 February and a future date: ignored, nothing invented (added stays the import time, as before)");
  ok(is.added > Date.now() - 60e3 && !("scanned" in is) && !("scans" in is) && !Object.values(r.S.coll).some(e => "scans" in e), "no dates: as before; no scan counts made up");
  // merging into a card already owned: earliest added / first scanned, latest last scanned
  r = await run(D, "deckhand-collection.csv", { kind: "coll" }, null, w => { const s = w.__t.S(); s.binders = s.binders || {}; const k = w.__t.addToColl(w.__t.slim(KNOWN[0]), "nonfoil", 2, null); Object.assign(s.coll[k], { added: Date.UTC(2024, 0, 1), scanned: Date.UTC(2025, 7, 1), firstScanned: Date.UTC(2025, 5, 1) }); });
  const m2 = Object.values(r.S.coll).find(e => e.name === "Sol Ring");
  ok(m2.qty === 3 && m2.added === Date.UTC(2024, 0, 1) && m2.scanned === Date.UTC(2025, 7, 1) && m2.firstScanned === U(2025, 3, 4, 10, 21), "into a card already owned: earliest added (2024) and first scanned (from the file), latest last scanned (already there)");
  // strict calendar dates (no rolling over), UTC when no zone is given
  r = await run(`Name,Set code,Collector number,Quantity,Date added,Last scanned,First scanned
Sol Ring,cmm,410,1,2024-02-29,2025-04-31,2025-02-29
Counterspell,mh2,267,1,2025-01-01 24:00,2025-13-01,2025-00-10
Lightning Bolt,m10,146,1,2025-01-01T05:30:00-06:00,2025-01-01 23:59,1992-12-31
`, "dates.csv", { kind: "coll" });
  const e2 = n => Object.values(r.S.coll).find(e => e.name === n);
  ok(e2("Sol Ring").added === Date.UTC(2024, 1, 29) && !("scanned" in e2("Sol Ring")) && !("firstScanned" in e2("Sol Ring")), "29 Feb 2024 (leap year) kept at midnight UTC; 31 April and 29 Feb 2025 rejected");
  ok(e2("Counterspell").added > Date.now() - 60e3 && !("scanned" in e2("Counterspell")) && !("firstScanned" in e2("Counterspell")), "hour 24, month 13 and month 0 rejected");
  ok(e2("Lightning Bolt").added === Date.UTC(2025, 0, 1, 11, 30) && e2("Lightning Bolt").scanned === Date.UTC(2025, 0, 1, 23, 59) && !("firstScanned" in e2("Lightning Bolt")), "a written time zone is applied; none means UTC; before 1993 rejected");
  // cards already owned with dates, and a file row with empty dates: their dates stay as they were
  const keep = { added: Date.UTC(2024, 0, 1), scanned: Date.UTC(2025, 7, 1), firstScanned: Date.UTC(2025, 5, 1) };
  r = await run(`Name,Set code,Collector number,Foil,Quantity,Date added,Last scanned,First scanned
Sol Ring,cmm,410,normal,1,,,
`, "empty-dates.csv", { kind: "coll" }, null, w => { const k = w.__t.addToColl(w.__t.slim(KNOWN[0]), "nonfoil", 2, null); Object.assign(w.__t.S().coll[k], keep); });
  const kept = Object.values(r.S.coll).find(e => e.name === "Sol Ring");
  ok(kept.qty === 3 && kept.added === keep.added && kept.scanned === keep.scanned && kept.firstScanned === keep.firstScanned, "empty dates in the file don't clear the dates already there");
  // a file with no date columns at all: exactly as before (new cards dated now, owned cards' dates untouched, nothing else added)
  r = await run(`Name,Set code,Collector number,Quantity
Sol Ring,cmm,410,1
Counterspell,mh2,267,2
`, "nodates.csv", { kind: "coll" }, null, w => { const k = w.__t.addToColl(w.__t.slim(KNOWN[0]), "nonfoil", 2, null); Object.assign(w.__t.S().coll[k], keep); });
  const nd = Object.values(r.S.coll).find(e => e.name === "Sol Ring"), nc = Object.values(r.S.coll).find(e => e.name === "Counterspell");
  ok(nd.qty === 3 && nd.added === keep.added && nd.scanned === keep.scanned && nd.firstScanned === keep.firstScanned && nc.qty === 2 && nc.added > Date.now() - 60e3 && !("scanned" in nc) && !("firstScanned" in nc) && !("newAt" in nc), "no date columns: imports as before");
  // another app's file with an "Added" column: not read as a date (unchanged)
  r = await run(`Name,Set code,Collector number,Quantity,Added\nSol Ring,cmm,410,1,2020-01-01\n`, "other.csv", { kind: "coll" });
  ok(Object.values(r.S.coll)[0].added > Date.now() - 60e3, "another app's \"Added\" column isn't treated as Deckhand's Date added");

  // ---- round trip: Deckhand's CSV export, imported again
  let exported = "", exportedBlob = null;
  r = await run(`Name,Set code,Collector number\nIsland,fdn,279\n`, "seed.csv", { kind: "coll" }, null, w => {
    const s = w.__t.S(); s.binders.trade = { id: "trade", name: "Trade" };
    const add = (i, fin, q, b, ex, h) => { const k = w.__t.addToColl(w.__t.slim(KNOWN[i]), fin, q, b, true, ex); Object.assign(s.coll[k], h); };
    add(0, "foil", 1000, "trade", { cond: "LP", paid: 1.25 }, { added: Date.UTC(2025, 2, 4, 10, 20), scanned: Date.UTC(2025, 5, 1, 8, 5), firstScanned: Date.UTC(2025, 2, 4, 10, 21), scans: 3 });
    add(3, "nonfoil", 4, null, {}, { added: Date.UTC(2025, 0, 2, 3, 4) });
    w.URL.createObjectURL = b => { exportedBlob = b; return "blob:x"; }; w.URL.revokeObjectURL = () => {};
  });
  const before = r.S, w0 = r.w; w0.__t.ioSheet(); w0.document.querySelector("#ioCsv").click(); exported = await new Promise(res => { const fr = new w0.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(exportedBlob); });
  const snap = S => Object.values(S.coll).map(e => [e.name, e.set, e.num, e.finish, e.qty, (S.binders[e.binder] || {}).name, e.cond || "NM", e.paid ?? "", e.added, e.scanned || "", e.firstScanned || ""].join("|")).sort();
  const want = snap(before).map(x => x.replace(/\|(\d{13})/g, (m, t) => "|" + Math.floor(+t / 60e3) * 60e3));
  r = await run(exported, "deckhand-collection-2026.csv", { kind: "coll" }, Object.assign(($, w) => { $("#impDest").value = "__file"; $("#impDest").dispatchEvent(new w.Event("change")); }, { after: () => {} }));
  const got = snap(r.S).filter(x => !/^Island\|fdn\|279\|nonfoil\|1\|/.test(x) || true);
  ok(/1,005 cards in 3 rows/.test(r.preview) && !r.bad, "the export reads back with no problem rows (1,000 written as 1000) " + (r.preview.match(/[\d,]+ cards in \d+ rows/) || [""])[0]);
  ok(JSON.stringify(got) === JSON.stringify(want), "round trip: card, set, number, finish, quantity, binder, condition, paid and the three dates match (to the minute)\n  " + got.join("\n  ") + "\n  vs\n  " + want.join("\n  "));
  ok(!Object.values(r.S.coll).some(e => "scans" in e), "the scan count isn't in the CSV, so it isn't made up on import");
  process.exit();
})();
