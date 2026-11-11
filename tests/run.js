// Runs every test: node tests/run.js         (all)
//                  node tests/run.js --quick (skips the slow text-reader tests)
const { spawnSync } = require("child_process"), fs = require("fs"), path = require("path");
const quick = process.argv.includes("--quick"), only = process.argv.slice(2).filter(a => !a.startsWith("--"));
require("./build.js");
const SLOW = ["gridtest.test.js", "phototest.test.js"];
const files = [...fs.readdirSync(path.join(__dirname, "unit")).filter(f => f.endsWith(".test.js")).map(f => path.join("unit", f)),
  ...fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js") && !(quick && SLOW.includes(f)))].filter(f => !only.length || only.some(o => f.includes(o)));
let pass = 0, fail = 0; const bad = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: path.dirname(path.join(__dirname, f)), encoding: "utf8", timeout: 600000 });
  const out = (r.stdout || "") + (r.stderr || ""), ok = (out.match(/^ok /gm) || []).length, nf = (out.match(/^FAIL /gm) || []).length;
  pass += ok; fail += nf;
  const broke = nf || r.status !== 0 || !ok;
  console.log(`${broke ? "FAIL" : "ok  "} ${f.padEnd(32)} ${ok} passed${nf ? `, ${nf} failed` : ""}${r.status !== 0 && !nf ? ` (exit ${r.status ?? r.signal})` : ""}`);
  if (broke) { bad.push(f); console.log(out.split("\n").filter(l => /^FAIL|Error|error|Timeout|waiting for|intercepts|at .*\.test\.js:\d+/.test(l)).slice(0, 12).map(l => "     " + l).join("\n")); }
}
console.log(`\n${pass} checks passed, ${fail} failed, in ${files.length} files${bad.length ? "\nProblems in: " + bad.join(", ") : ""}`);
process.exit(bad.length ? 1 : 0);
