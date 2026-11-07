// Deck/list lines in the formats other sites export (Arena, Moxfield, Archidekt, TappedOut, MTGO), finishes written
// short or out, and the camera's error messages.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const CASES = [
  ["1 Lightning Bolt (STA) 42", "1|Lightning Bolt|sta|42||main", "MTG Arena"],
  ["1 Sol Ring (CMM) 410 *F*", "1|Sol Ring|cmm|410|foil|main", "Moxfield foil"],
  ["1 Sol Ring (CMM) 410 *E*", "1|Sol Ring|cmm|410|etched|main", "Moxfield etched"],
  ["1 Sol Ring (CMM) 410 *Etched*", "1|Sol Ring|cmm|410|etched|main", "etched written out"],
  ["1 Sol Ring (CMM) 410 *Foil*", "1|Sol Ring|cmm|410|foil|main", "foil written out"],
  ["1 Sol Ring [CMM] 410 (Foil)", "1|Sol Ring|cmm|410|foil|main", "set in square brackets"],
  ["1 Sol Ring - Etched Foil", "1|Sol Ring|||etched|main", "“- Etched Foil”"],
  ["2x Brainstorm (foil)", "2|Brainstorm|||foil|main", "(foil)"],
  ["1x Sol Ring (cmm) 410 [Ramp]", "1|Sol Ring|cmm|410||main", "Archidekt category"],
  ["1 Esika's Chariot (KHM) 169 *F* [Commander{top}]", "1|Esika's Chariot|khm|169|foil|commander", "Archidekt commander, foil"],
  ["1 Kenrith, the Returned King *CMDR*", "1|Kenrith, the Returned King||||commander", "TappedOut commander"],
  ["1 Delver of Secrets // Insectile Aberration (ISD) 51", "1|Delver of Secrets // Insectile Aberration|isd|51||main", "double-faced card"],
  ["1 Fire // Ice (MH2) 290", "1|Fire // Ice|mh2|290||main", "split card"],
  ["SB: 2 Duress", "2|Duress||||sideboard", "MTGO sideboard"],
  ["1 Sketched Cartographer", "1|Sketched Cartographer||||main", "a name containing “etched” isn't a finish"],
];
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8823", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await b.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, body: "{}" }));
  await p.goto("http://127.0.0.1:8823/app_real.html"); await p.waitForTimeout(500);
  const got = await p.evaluate(L => L.map(l => textListRows([l]).slice(1)[0].join("|")), CASES.map(c => c[0]));
  CASES.forEach(([line, want, what], i) => ok(got[i] === want, `${what}: ${line} → ${got[i]}`));
  const partners = await p.evaluate(() => textListRows(["Commander", "1 Thrasios, Triton Hero", "1 Tymna the Weaver", "", "Deck", "1 Sol Ring"]).slice(1).map(r => r[1] + ":" + r[5]).join(", "));
  ok(partners === "Thrasios, Triton Hero:commander, Tymna the Weaver:commander, Sol Ring:main", `two partner commanders (${partners})`);
  const cam = await p.evaluate(() => ["NotAllowedError", "NotFoundError", "NotReadableError", "TypeError"].map(n => camError({ name: n, message: n === "TypeError" ? "boom" : "" })));
  ok(/blocked/.test(cam[0]) && /No camera found/.test(cam[1]) && /busy/.test(cam[2]) && /didn't start \(boom\)/.test(cam[3]), `the camera says what went wrong: ${cam.map(x => x.split(".")[0]).join(" | ")}`);
  ok(!errs.length, "no errors " + JSON.stringify(errs));
  await b.close(); srv.kill();
})();
