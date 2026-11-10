// The text reader: if getting its two readers ready fails partway, the ones already started are shut down,
// and trying again starts cleanly (no extra readers left using memory).
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8834", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext()).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.abort());
  await p.goto("http://127.0.0.1:8834/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(async () => {
    let plan = [], n = 0; const live = new Set();
    window.Tesseract = { createWorker: async () => { const step = plan.shift();
      if (step === "fail") throw new Error("couldn't start");
      const w = { id: ++n, terminate: async () => { live.delete(w.id); }, setParameters: async () => { if (step === "badparams") throw new Error("bad settings"); } };
      live.add(w.id); return w; } };
    const out = {};
    // the second reader fails to start
    plan = ["ok", "fail"]; out.e1 = await getWorkers().then(() => "ready", e => e.message); out.live1 = [...live];
    // both start, but setting one up fails
    plan = ["badparams", "ok"]; out.e2 = await getWorkers().then(() => "ready", e => e.message); out.live2 = [...live];
    // trying again works, with just two readers running
    plan = ["ok", "ok"]; out.e3 = await getWorkers().then(w => w.length + " ready", e => e.message); out.live3 = [...live];
    // later calls reuse them
    out.same = (await getWorkers()) === workers && live.size === 2;
    return out;
  });
  console.log(JSON.stringify(R));
  ok(R.e1 === "couldn't start" && R.live1.length === 0, "second reader fails to start: the first is shut down " + JSON.stringify(R.live1));
  ok(R.e2 === "bad settings" && R.live2.length === 0, "setting a reader up fails: both are shut down " + JSON.stringify(R.live2));
  ok(R.e3 === "2 ready" && R.live3.length === 2 && R.same, "trying again starts cleanly, two readers, reused afterwards " + JSON.stringify(R.live3));
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
