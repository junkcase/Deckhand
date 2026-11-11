// Scanner speed fixes: a card lookup you're waiting on retries quickly after a dropped connection (it waited 2 s, which
// made ~3 s lookups) and gives up on a stalled one after 8 s; background batches still wait patiently; the card-name
// list loads when the Scan tab opens; the scan log reports each step's median / slowest 5% / slowest, scanner time apart
// from card handling, and how results split by confidence.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8840", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] }), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  let mode = "drop", calls = 0, namesAsked = 0;
  const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
  const CARD = { object: "card", id: "sol", oracle_id: "osol", name: "Sol Ring", set: "cmm", set_name: "CMM", collector_number: "1", rarity: "uncommon", type_line: "Artifact", cmc: 1, colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], image_uris: {} };
  await p.route("https://api.scryfall.com/**", async r => { const u = r.request().url();
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.includes("/catalog/card-names")) { namesAsked++; return r.fulfill({ status: 200, headers: H, contentType: "application/json", body: JSON.stringify({ data: ["Sol Ring"] }) }); }
    if (u.includes("/cards/collection")) { calls++;
      if (mode === "drop" && calls === 1) return r.abort("connectionreset");
      if (mode === "stall" && calls === 1) return;            // never answers
      return r.fulfill({ status: 200, headers: H, contentType: "application/json", body: JSON.stringify({ data: [CARD], not_found: [] }) }); }
    return r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.route("https://**", r => r.fulfill({ status: 404, headers: H, body: "{}" }));
  await p.goto("http://127.0.0.1:8840/app_real.html"); await p.waitForTimeout(500);
  const R = {};
  const timed = fn => p.evaluate(async src => { const t = performance.now(); let res; try { res = await eval(src); } catch (e) { res = "error: " + e.message; } return [Math.round(performance.now() - t), JSON.stringify(res).slice(0, 60)]; }, fn);
  // 1. a scan lookup after a dropped connection
  R.drop = await timed(`sf("/cards/collection", { identifiers: [{ name: "Sol Ring" }] }, { now: true }).then(r => r.data.length)`); R.dropCalls = calls;
  // 2. a background batch after a dropped connection still waits (it isn't in a hurry)
  calls = 0; R.bg = await timed(`sf("/cards/collection", { identifiers: [{ name: "Sol Ring" }] }, { queue: true }).then(r => r.data.length)`);
  // 3. a stalled connection: given up on after 8 s and tried again
  calls = 0; mode = "stall"; R.stall = await timed(`sf("/cards/collection", { identifiers: [{ name: "Sol Ring" }] }, { now: true }).then(r => r.data.length)`); R.stallCalls = calls;
  // 4. opening Scan starts loading the card-name list
  await p.evaluate(() => go("scan")); await p.waitForFunction(() => $("#vid") && $("#vid").videoWidth > 0, null, { timeout: 8000 }); await p.waitForTimeout(800);
  R.names = [namesAsked, await p.evaluate(() => !!NAMES)];
  // 5. the scan log
  const log = await p.evaluate(async () => {
    stopAuto();
    const mk = (i, ok, conf, read, ms) => ({ at: Date.now() - (20 - i) * 3000, try: 1, ok, conf, result: ok ? "x" : "not read", read, raw: read, src: "photo", res: "1x1", pre: { find: 100, small: 0, moving: 200, hold: 100 }, ms: Object.assign({ wait: 400 }, ms) });
    sc.log = S.scanLog = [];
    for (let i = 0; i < 20; i++) S.scanLog.push(mk(i, i % 2 === 0, i % 4 === 0 ? "high" : "medium", i % 2 ? "" : "Sol Ring", { capture: 700 + i, prep: 10, ocr: 200 + i * 10, match: 2, lookup: i === 19 ? 3000 : 100, total: 1100 + i * 20 }));
    sc.log = S.scanLog; drawLog();
    const shown = $("#scLog").textContent.replace(/\s+/g, " ");
    $("#logCopy").click(); await new Promise(r => setTimeout(r, 300));
    return [shown, await navigator.clipboard.readText()];
  });
  R.shown = log[0].match(/Slowest 5%[^·]*·[^·]*·[^·]*·[^C]*/)?.[0]; R.copy = log[1].split("\n").slice(1, 6);
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  ok(R.drop[1] === "1" && R.drop[0] < 1500 && R.dropCalls === 2, `a scan lookup after a dropped connection: retried quickly (${R.drop[0]} ms; it took 2 s+ before)`);
  ok(R.bg[1] === "1" && R.bg[0] >= 1900, `a background batch still waits ~2 s before retrying (${R.bg[0]} ms)`);
  ok(R.stall[1] === "1" && R.stall[0] >= 7900 && R.stall[0] < 10000 && R.stallCalls === 2, `a stalled lookup is given up on after 8 s and tried again (${R.stall[0]} ms)`);
  ok(R.names[0] >= 1 && R.names[1], "opening Scan loads the card-name list before the first card " + JSON.stringify(R.names));
  ok(/stage p50\/p95\/max ms: capture 710\/719\/719, prep 10\/10\/10, ocr 300\/390\/390, match 2\/2\/2, lookup 100\/3000\/3000, total 1300\/1480\/1480/.test(R.copy[2]), "copied log: each step's median, slowest 5% and slowest " + R.copy[2]);
  ok(/scanner time \(capture to result\) median 1300 ms, p95 1480 ms; card handling before the snapshot median 400 ms/.test(R.copy[3]), "copied log: scanner time apart from card handling " + R.copy[3]);
  ok(/results: 5 high \(added\), 5 medium \(to check\), 0 low \(you pick\), 10 not read \(10 with no name text at all\)/.test(R.copy[4]), "copied log: results by confidence " + R.copy[4]);
  ok(/Slowest 5% of each step/.test(R.shown || ""), "the scan log screen shows the slowest 5% too: " + R.shown);
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
