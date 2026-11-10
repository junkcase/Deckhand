// Scanning a photo file: the decoded picture is closed and the temporary image address is let go after reading,
// whether the card is found or reading fails (so repeated scans don't pile up memory on a phone).
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8833", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext()).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.abort());
  await p.goto("http://127.0.0.1:8833/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(async png => {
    const file = new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: "image/png" });
    const made = [], gone = [], closed = []; const mk = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = x => { const u = mk(x); made.push(u); return u; }; URL.revokeObjectURL = u => { gone.push(u); rv(u); };
    const fake = { recognize: async () => ({ data: { text: "", confidence: 0 } }) };
    getWorkers = async () => [fake, fake];
    const out = {};
    // 1. the browser decodes it directly: the picture is closed
    const cib = window.createImageBitmap; window.createImageBitmap = async (...a) => { const bm = await cib(...a), c = bm.close.bind(bm); bm.close = () => { closed.push(1); c(); }; return bm; };
    identify = async () => false; await captureFrom("file", file); out.bitmapClosed = closed.length;
    // 2. the fallback through an <img>: its address is let go, found or not
    window.createImageBitmap = () => Promise.reject(new Error("unsupported"));
    identify = async () => true; await captureFrom("file", file);
    identify = async () => { throw new Error("lookup failed"); }; await captureFrom("file", file);
    out.made = made.length; out.revoked = made.filter(u => gone.includes(u)).length;
    window.createImageBitmap = cib; return out;
  }, PNG);
  console.log(JSON.stringify(R));
  ok(R.bitmapClosed === 1, "a photo decoded by the browser is closed after reading " + R.bitmapClosed);
  ok(R.made === 2 && R.revoked === 2, `the fallback's temporary image addresses are let go, found or failed (${R.revoked}/${R.made})`);
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
