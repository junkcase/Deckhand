const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (id, name, set, num) => ({ id, oracle_id: "o" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: [], color_identity: [], prices: { usd: "2.00" }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const DB = [C("b1", "Lightning Bolt", "2x2", "117"), C("b0", "Lightning Bolt", "lea", "161"), C("c1", "Counterspell", "mh2", "267"), C("h1", "Lightning Helix", "rav", "213"), C("t1", "Thought Scour", "mh2", "52"), C("t2", "Thoughtseize", "2xm", "107"), C("s1", "Sol Ring", "cmm", "1")];
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
  const calls = [];
  w.fetch = async (u, o) => { u = decodeURIComponent(String(u)); calls.push(u); const J = (j, st = 200) => ({ ok: st === 200, status: st, json: async () => j });
    if (u.includes("card-names")) return J({ data: [...new Set(DB.map(c => c.name))] });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(o.body).identifiers; return J({ data: ids.map(i => i.collector_number ? DB.find(c => c.set === i.set && c.collector_number === i.collector_number) : DB.find(c => c.name === i.name && (!i.set || c.set === i.set))).filter(Boolean) }); }
    return J({}, 404); };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={go,sc,identify,loadNames,S,scanStats,logScan,drawLog};");
  await new Promise(r => setTimeout(r, 150));
  const T = w.T; T.go("scan"); await T.loadNames();
  const run = async (mode, name, info, conf) => { T.sc.mode = mode; T.sc.cur = { t0: 0, ms: {} }; const n0 = calls.length; const r = await T.identify(name, info, conf); const c = T.sc.cur; return { r, c, it: T.sc.items.at(-1), net: calls.slice(n0).filter(u => !u.includes("card-names") && !u.endsWith("/sets")).length }; };
  const coll = () => Object.values(T.S.coll).reduce((a, e) => a + e.qty, 0);

  let x = await run("any", "Lightnlng Bolt", "0117/332 U\n2X2 • EN", 85);
  ok(x.c.conf === "high" && x.it.exact && x.it.state === "added", "name + set code agree → high, exact printing, added in bulk");
  ok(x.net === 1, "one request for the whole lookup (" + x.net + ")");
  const c1 = coll(); x = await run("any", "Lightnlng Bolt", "0117/332 U\n2X2 • EN", 85);
  ok(x.net === 0 && coll() === c1 + 1, "same card again (second copy): no network at all, collection +1 (net " + x.net + ")");

  x = await run("any", "Lightnig Bolt", "", 40);
  ok(x.c.conf === "medium" && x.it.state === "review" && x.it.conf === "medium", "one letter off and low OCR confidence (40) → medium, waits in the list even in bulk");
  x = await run("ask", "Counterspell", "", 40);
  ok(x.c.conf === "high", "name read exactly → high even when the reader's own confidence is low");
  ok(/please check/.test(w.document.querySelector("#scSession").textContent), "list row says 'Likely match: please check'");

  x = await run("any", "Counterspel", "", 88);
  ok(x.c.conf === "high" && x.it.state === "added" && !x.it.exact, "very clean name read, no set code → high, added (printing not claimed exact)");

  x = await run("any", "Lightn Helx", "", 70);
  ok(x.c.conf !== "high" && (!x.it || x.it.state !== "added" || x.it.card.name !== "Lightning Helix"), "weaker read (" + x.c.score + ") is never added automatically: " + x.c.conf);

  x = await run("any", "Thought", "", 90);
  ok(x.c.conf === "low" && x.it.state === "pick" && x.it.cands.length >= 2, "two close names → low, you choose: " + (x.it.cands || []).join(", "));

  const before = coll();
  x = await run("exact", "Sol Rlng", "", 92);
  ok(x.it.state === "review" && coll() === before, "'exact printings' bulk mode: name read but no set code → listed, not added");

  const log = T.S.scanLog || [];
  T.sc.cur = null;
  for (const [ok_, tot] of [[1, 900], [1, 1100], [1, 1300], [0, 2500], [1, 4000]]) T.logScan({ at: Date.now(), ok: ok_, conf: ok_ ? "high" : "", ms: { capture: 100, prep: 50, ocr: tot - 300, match: 9, lookup: 140, total: tot }, wait: 300 });
  const st = T.scanStats(T.S.scanLog);
  ok(st.ok === 4 && st.n === 5 && st.med === 1300 && st.p95 === 4000, `stats: ${st.ok}/${st.n} read, median ${st.med} ms, p95 ${st.p95} ms`);
  T.drawLog();
  const lt = w.document.querySelector("#scLog").textContent;
  ok(/Median/.test(lt) && /read text/.test(lt) && w.document.querySelector("#logCopy"), "scan log panel shows step times and a Copy log button");
})();
