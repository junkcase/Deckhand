// Auto-scan pacing: no rapid-fire shots of nothing. A snapshot with no card name in it (no edges found, or two in a row
// with edges) stops and waits for the picture to change, without logging a failed card; a real card that won't read
// is retried with a pause and logged after 4 tries; reading the on-screen frame without edges waits longer.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8838", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext()).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.abort());
  await p.goto("http://127.0.0.1:8838/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(async () => {
    go("scan"); await new Promise(r => setTimeout(r, 300)); stopAuto(); sc.auto = true; sc.items = []; const s = { L: new Float32Array(144 * 200) };
    let read = ""; const setEdges = on => { det.box = on ? { x: 0, y: 0, w: 1, h: 1, a: 0 } : null; det.seen = performance.now() + 1e9; };
    grabShot = async () => ({ c: document.createElement("canvas"), src: "snapshot", res: "1x1" });
    captureFrom = async () => { sc.lastRead = read; return false; };
    const state = () => [ana.armed, ana.fails, sc.items.length, ana.failMsg];
    const reset = () => Object.assign(ana, { armed: true, fails: 0, empties: 0, failMsg: "", cool: 0 });
    const out = { guide: AUTO.guideWait, gap: AUTO.retryGap };
    // 1. no card edges, nothing read
    reset(); setEdges(false); read = ""; await shootAndRead(s); out.noEdges = state();
    // 2. edges found, nothing read: one more try, then stop
    reset(); setEdges(true); read = "d"; await shootAndRead(s); out.edges1 = state(); const t = performance.now(); out.cool = Math.round(ana.cool - t);
    await shootAndRead(s); out.edges2 = state();
    // 3. a real card whose name reads as garbage: 4 tries, then logged as couldn't read
    reset(); setEdges(true); read = "Pyxis Pande ou"; for (let i = 0; i < 4; i++) await shootAndRead(s); out.garbage = state();
    // 4. without edges, but a name-like read that doesn't match: still retried (it may be a card)
    reset(); setEdges(false); read = "Locus BEET"; await shootAndRead(s); out.noEdgesText = state();
    return out;
  });
  console.log(JSON.stringify(R));
  ok(R.guide === 2500 && R.gap === 700, "waits longer for the card's edges before reading the frame anyway, and pauses before retrying");
  ok(R.noEdges[0] === false && R.noEdges[1] === 0 && R.noEdges[2] === 0 && /No card name there/.test(R.noEdges[3]), "no edges and nothing read: stops until the picture changes, nothing logged " + JSON.stringify(R.noEdges));
  ok(R.edges1[0] === true && R.edges1[1] === 1 && R.cool >= 650, "edges found but nothing read: tries once more, after a pause " + JSON.stringify([R.edges1, R.cool]));
  ok(R.edges2[0] === false && R.edges2[2] === 0 && /No card name there/.test(R.edges2[3]), "nothing again: stops, nothing logged " + JSON.stringify(R.edges2));
  ok(R.garbage[0] === false && R.garbage[2] === 1 && /Couldn't read that one/.test(R.garbage[3]), "a card that won't read: 4 tries, then logged as couldn't read " + JSON.stringify(R.garbage));
  ok(R.noEdgesText[0] === true && R.noEdgesText[1] === 1, "name-like text without edges is still retried " + JSON.stringify(R.noEdgesText));
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
