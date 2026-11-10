// "A new version is ready": noticed while the page stays open, Update now saves first and loads the new version.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process"); const fs = require("fs");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8792", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(devices["Pixel 7"])).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  let served = fs.readFileSync(__dirname + "/app_real.html", "utf8"), checks = 0;
  await p.route("**/app_real.html?update-check=*", r => { checks++; r.fulfill({ status: 200, contentType: "text/html", body: served }); });
  await p.goto("http://127.0.0.1:8792/app_real.html"); await p.waitForTimeout(3600);
  const R = {};
  R.first = [checks, !(await p.$("#updBar"))];
  await p.evaluate(() => checkUpdate()); R.same = !(await p.$("#updBar"));
  await p.evaluate(() => { S.binders.main = { id: "main", name: "Collection" }; S.decks.e = { id: "e", name: "Eluge", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); });   // unsaved for 250 ms
  served = served.replace("</body>", "<!-- new version --></body>");            // a new version goes live
  await p.evaluate(() => checkUpdate()); await p.waitForTimeout(200);
  R.bar = await p.$eval("#updBar", e => e.textContent.replace(/\s+/g, " ")).catch(() => null);
  await p.screenshot({ path: __dirname + "/update_phone.png" });
  // coming back to the app also checks
  served = served.replace("<!-- new version -->", "<!-- newer -->"); const c0 = checks;
  await p.evaluate(() => { UPD.last = 0; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(300); R.onReturn = checks > c0;
  // saving fails (storage full or blocked): it doesn't reload and lose changes; it says so and offers a backup
  await p.evaluate(() => { window.__idbOk = idb.ok; idb.ok = false; window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); }; window.__nav = 0; window.addEventListener("beforeunload", () => window.__nav++); });
  await p.click("#updGo"); await p.waitForTimeout(1500);
  R.blocked = await p.evaluate(() => [window.__nav, (document.querySelector("#updBar") || {}).textContent || "", ["#updBk", "#updRetry", "#updAnyway"].every(s => document.querySelector(s))]);
  await p.evaluate(() => { idb.ok = window.__idbOk; Storage.prototype.setItem = window.__set; });
  // saving throws instead of failing quietly: still no reload
  await p.evaluate(() => { window.__fs = flushSave; flushSave = () => Promise.reject(new Error("broken")); });
  await p.click("#updRetry"); await p.waitForTimeout(1200);
  R.thrown = await p.evaluate(() => [window.__nav, /Couldn't save your latest changes/.test((document.querySelector("#updBar") || {}).textContent || "")]);
  await p.evaluate(() => { flushSave = window.__fs; });
  await Promise.all([p.waitForNavigation({ timeout: 10000 }), p.click("#updRetry")]); await p.waitForTimeout(800);
  R.after = await p.evaluate(() => [!!(S.decks.e && S.decks.e.name === "Eluge"), !document.querySelector("#updBar")]);
  R.errs = errs; await b.close(); srv.kill();
  ok(R.first[0] === 1 && R.first[1], "on opening, it notes which version it is without bothering you");
  ok(R.same, "same version: no notice");
  ok(R.bar && /A new version of Deckhand is ready/.test(R.bar) && /Update now/.test(R.bar), `a newer version on the server shows the notice (${R.bar})`);
  ok(R.onReturn, "coming back to the app checks again");
  ok(R.blocked[0] === 0 && /Couldn't save your latest changes/.test(R.blocked[1]) && R.blocked[2], `if saving fails it doesn't reload; it says so and offers Export a backup / Try again / Update anyway ${JSON.stringify(R.blocked)}`);
  ok(R.thrown[0] === 0 && R.thrown[1], "if saving throws an error it doesn't reload either " + JSON.stringify(R.thrown));
  ok(R.after[0] && R.after[1], "Try again (storage back) saves first (the just-added deck survives the reload) and loads the new version");
  ok(!R.errs.length, "no console errors " + JSON.stringify(R.errs));
})();
