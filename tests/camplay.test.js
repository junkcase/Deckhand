// The camera only says "Ready" and starts scanning once the picture is really showing. If the browser refuses to play it
// or no picture comes, it says so (tap to try again, or use the photo button) and doesn't start scanning.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8835", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 412, height: 860 } })).newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" })); return p; };
  const st = p => p.$eval("#scStatus", e => e.textContent);
  const R = {};
  // 1. a working camera: ready, scanning on
  let p = await page(); await p.goto("http://127.0.0.1:8835/app_real.html"); await p.waitForTimeout(400);
  await p.evaluate(() => go("scan")); await p.waitForFunction(() => /^Ready/.test(($("#scStatus") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(500); R.ok = [await st(p), await p.evaluate(() => !!ana.timer && $("#vid").videoWidth > 0)];
  await p.context().close();
  // 2. the browser refuses to play the video (as iPhone Low Power Mode can)
  p = await page(); await p.goto("http://127.0.0.1:8835/app_real.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.pause(); return Promise.reject(new DOMException("needs a tap", "NotAllowedError")); };
    const v = document.createElement("video"); v.autoplay = false; go("scan"); document.querySelector("#vid").removeAttribute("autoplay"); });
  await p.waitForTimeout(5000);
  R.refused = [await st(p), await p.evaluate(() => !!ana.timer)];
  // a tap, now that playing is allowed, starts it
  await p.evaluate(() => { HTMLMediaElement.prototype.play = window.__play; }); await p.click("#vid");
  await p.waitForFunction(() => /^Ready/.test(($("#scStatus") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
  R.tapped = [await st(p), await p.evaluate(() => !!ana.timer)];
  await p.context().close();
  // 3. the camera turns on but gives no picture
  p = await page(); await p.goto("http://127.0.0.1:8835/app_real.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 480; const s = c.captureStream(0); navigator.mediaDevices.getUserMedia = async () => s; go("scan"); });
  await p.waitForTimeout(5000);
  R.blank = [await st(p), await p.evaluate(() => !!ana.timer)];
  await p.context().close();
  console.log(JSON.stringify(R, null, 1));
  ok(!/Tap the camera area/.test(R.ok[0]) && R.ok[1], "a working camera: scanning, no camera problem shown " + JSON.stringify(R.ok));
  ok(/didn't let the camera start on its own\. Tap the camera area to try again, or use the photo button\./.test(R.refused[0]) && !R.refused[1], "playing refused: says so, offers a tap or the photo button, doesn't start scanning: " + R.refused[0]);
  ok(!/Tap the camera area/.test(R.tapped[0]) && R.tapped[1], "a tap on the camera area starts it " + JSON.stringify(R.tapped));
  ok(/no picture is showing\. Tap the camera area to try again, or use the photo button\./.test(R.blank[0]) && !R.blank[1], "no picture from the camera: says so, doesn't start scanning: " + R.blank[0]);
  ok(!errs.length, "no page errors " + errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
