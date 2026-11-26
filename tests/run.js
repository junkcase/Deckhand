// Runs every test: node tests/run.js          (all, two files at a time)
//                  node tests/run.js --serial (all, one file at a time: for timing-sensitive problems)
//                  node tests/run.js --quick  (skips the slow text-reader tests; works with --serial)
// Each file runs in its own node process, with up to 10 minutes; its result is printed in the usual order whichever finishes first.
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path");
const quick = process.argv.includes("--quick"), serial = process.argv.includes("--serial"), only = process.argv.slice(2).filter(a => !a.startsWith("--"));
require("./build.js");
const SLOW = ["gridtest.test.js", "phototest.test.js"], LIMIT = 600000, WORKERS = 2;
const files = [...fs.readdirSync(path.join(__dirname, "unit")).filter(f => f.endsWith(".test.js")).map(f => path.join("unit", f)),
  ...fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js") && !(quick && SLOW.includes(f)))].filter(f => !only.length || only.some(o => f.includes(o)));
let pass = 0, fail = 0; const bad = [];
// one file's result, as it has always been printed: ok/FAIL, checks, the exit code if it ended badly, and the lines that explain a failure
function report(f, out, status, signal, timedOut) {
  const ok = (out.match(/^ok /gm) || []).length, nf = (out.match(/^FAIL /gm) || []).length;
  pass += ok; fail += nf;
  const broke = nf || status !== 0 || !ok;
  console.log(`${broke ? "FAIL" : "ok  "} ${f.padEnd(32)} ${ok} passed${nf ? `, ${nf} failed` : ""}${status !== 0 && !nf ? ` (exit ${status ?? signal})` : ""}`);
  if (broke) { bad.push(f); console.log([...(timedOut ? [`stopped after ${LIMIT / 60000} minutes`] : []), ...out.split("\n").filter(l => /^FAIL|Error|error|Timeout|waiting for|intercepts|at .*\.test\.js:\d+/.test(l)).slice(0, 12)].map(l => "     " + l).join("\n")); }
}
function summary() {
  console.log(`\n${pass} checks passed, ${fail} failed, in ${files.length} files${bad.length ? "\nProblems in: " + bad.join(", ") : ""}`);
  process.exit(bad.length ? 1 : 0);
}
if (serial) {
  for (const f of files) {
    const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: path.dirname(path.join(__dirname, f)), encoding: "utf8", timeout: LIMIT });
    report(f, (r.stdout || "") + (r.stderr || ""), r.status, r.signal, !!(r.error && r.error.code === "ETIMEDOUT"));
  }
  summary();
} else {
  // Two files at a time. Each runs in its own process group, so that stopping it (after 10 minutes, or when this runner is stopped)
  // also stops the web server and browser it started.
  const results = new Array(files.length), running = new Set(), groups = new Set(); let next = 0, shown = 0;
  const signal = (g, s) => { try { process.kill(-g, s); return true; } catch (e) { return false; } }, alive = g => signal(g, 0);
  const stop = c => signal(c.pid, "SIGTERM");
  // before the summary: whatever the files left behind (a web server, a browser) has gone, or is made to go after 3 seconds
  const reap = async () => { const t = Date.now(); while ([...groups].some(alive) && Date.now() - t < 3000) await new Promise(r => setTimeout(r, 100)); for (const g of groups) if (alive(g)) signal(g, "SIGKILL"); };
  const show = () => { while (shown < files.length && results[shown]) { const r = results[shown++]; report(r.f, r.out, r.status, r.signal, r.timedOut); } };
  const run = i => new Promise(done => {
    const f = files[i], full = path.join(__dirname, f), c = spawn(process.execPath, [full], { cwd: path.dirname(full), detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let so = "", se = "", timedOut = false, ended = false; running.add(c);
    c.stdout.setEncoding("utf8"); c.stderr.setEncoding("utf8"); c.stdout.on("data", d => so += d); c.stderr.on("data", d => se += d);
    const limit = setTimeout(() => { timedOut = true; stop(c); }, LIMIT);
    const end = (status, sig) => { if (ended) return; ended = true; clearTimeout(limit); running.delete(c); if (c.pid) { groups.add(c.pid); stop(c); }
      results[i] = { f, out: so + se, status, signal: sig, timedOut }; show(); done(); };
    c.on("close", end); c.on("error", e => { se += `\nError: ${e.message}`; end(null, null); });
  });
  // stopped (Ctrl+C, or the job cancelled): the running files are stopped too, firmly if they haven't gone within a second
  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => {
    if (stopping) return; stopping = true;
    console.log(`\nStopped (${sig}) with ${running.size} file${running.size === 1 ? "" : "s"} running: ${shown} of ${files.length} files reported`);
    for (const c of running) { groups.add(c.pid); stop(c); }
    setTimeout(() => { for (const g of groups) if (alive(g)) signal(g, "SIGKILL"); process.exit(130); }, 1000);
  });
  Promise.all(Array.from({ length: Math.min(WORKERS, files.length) }, async () => { while (!stopping && next < files.length) await run(next++); })).then(() => { if (!stopping) return reap().then(summary); });
}
