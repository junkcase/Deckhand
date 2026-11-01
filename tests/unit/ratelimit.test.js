// Scryfall request spacing: 2/s for search, named, random, collection; 10/s for the rest; blocks are waited out, not hammered.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {}; w.indexedDB = new IDBFactory();
  let log = [], mode = "ok";
  w.fetch = async (u, o) => { const t = Date.now(); log.push([new URL(u).pathname, t]);
    if (mode === "block") throw new TypeError("Failed to fetch");
    if (mode === "429") return { ok: false, status: 429, json: async () => ({ details: "Too many requests" }) };
    return { ok: true, status: 200, json: async () => ({ object: "list", data: [] }) }; };
  w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={sf,P:v=>{if(v!==undefined)sfPauseUntil=v;return sfPauseUntil}};");
  await new Promise(r => setTimeout(r, 400));
  const T = w.T; log = [];
  const gaps = rows => rows.slice(1).map((r, i) => r[1] - rows[i][1]);
  // five searches started at the same moment, plus five set lookups
  await Promise.all([...Array(5)].map((_, i) => T.sf("/cards/search?q=x" + i)).concat([...Array(5)].map(() => T.sf("/sets/dom"))));
  const slow = log.filter(r => r[0].startsWith("/cards/search")), fast = log.filter(r => r[0].startsWith("/sets"));
  ok(Math.min(...gaps(slow)) >= 500, `searches go out at most 2 a second, even when started together (gaps ${gaps(slow).join(", ")} ms)`);
  ok(Math.min(...gaps(log)) >= 100, `nothing goes faster than 10 a second (smallest gap ${Math.min(...gaps(log))} ms)`);
  ok(slow.at(-1)[1] - log[0][1] < 2600, "5 searches take about 2 seconds, not longer");
  log = []; const t0 = Date.now();
  await Promise.all([T.sf("/cards/collection", { identifiers: [] }), T.sf("/cards/collection", { identifiers: [] }), T.sf("/cards/named?exact=Sol"), T.sf("/cards/abc"), T.sf("/cards/autocomplete?q=so")]);
  const col = log.filter(r => /collection|named/.test(r[0]));
  ok(Math.min(...gaps(col)) >= 500, `bulk lookups and name lookups share the 2-a-second limit (gaps ${gaps(col).join(", ")})`);
  ok(log.filter(r => /\/cards\/(abc|autocomplete)/.test(r[0])).every(r => r[1] - t0 < 900), "a card by ID and autocomplete use the faster limit");
  // a failed connection: a couple of spaced-out retries, then a message that also names the "busy on another device" cause
  await new Promise(r => setTimeout(r, 600)); mode = "block"; log = [];
  let err = null; try { await T.sf("/cards/search?q=y"); } catch (e) { err = e; }
  ok(err && /Couldn't reach Scryfall/.test(err.message) && /another device on the same Wi-Fi/.test(err.message), "a failed connection says what to check, including Scryfall pausing a busy connection");
  ok(log.length === 3 && Math.min(...gaps(log)) >= 500, `it retries twice, spaced out (${log.length} tries, gaps ${gaps(log).join(", ")})`);
  // a real 429 also books the 30-second pause
  T.P(0); mode = "429"; err = null; try { await T.sf("/sets/x"); } catch (e) { err = e; }
  ok(err && err.status === 429 && /pausing requests/.test(err.message) && T.P() - Date.now() > 25000, "a 429 from Scryfall pauses everything for 30 seconds");
  // background jobs wait the pause out and finish
  mode = "ok"; T.P(Date.now() + 1500); log = []; const t1 = Date.now();
  await T.sf("/cards/collection", { identifiers: [] });
  ok(log.length === 1 && log[0][1] - t1 >= 1400, "a background job waits for the pause to end, then carries on");
  process.exit();
})();
