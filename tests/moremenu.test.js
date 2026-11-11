// Collection list: Select stays up front; the other tools are in "⋯ More", which closes after a pick or a tap elsewhere,
// and shows ⚠ when sync needs attention.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8808/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { for (let i = 0; i < 30; i++) addToColl({ id: "c" + i, name: "Card " + i, set: "tst", num: String(i), prices: { usd: String(i) }, finishes: ["nonfoil"] }, "nonfoil", 1, "main", true); save(); go("coll"); showList(); });
  await p.waitForTimeout(300);
  const R = {};
  R.front = await p.$$eval("#view .btn", a => a.filter(x => x.getBoundingClientRect().width > 0).map(x => x.textContent.trim()).filter(t => /Update prices|Import CSV|Value breakdown|Duplicates|Price alerts|Backup|Sync$|Select|More/.test(t)));
  R.listTop = await p.$eval("#clist", e => Math.round(e.getBoundingClientRect().top));
  await p.click("#cMoreMenu > summary"); await p.waitForTimeout(100);
  R.items = await p.$$eval("#cMoreMenu .mi", a => a.filter(x => x.getBoundingClientRect().width > 0).map(x => x.textContent.trim()));
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click("#cDup"); await p.waitForTimeout(250); R.afterPick = [await p.$eval("#cMoreMenu", e => e.open).catch(() => "gone"), await p.evaluate(() => /Duplicates/.test(document.querySelector("#sheetRoot").textContent))];
  await p.evaluate(() => closeSheet()); await p.waitForTimeout(150);
  await p.click("#cMoreMenu > summary"); await p.waitForTimeout(80);
  // a tap somewhere the open menu doesn't cover (it opens upward when there's no room below, over what's above it)
  const away = await p.evaluate(() => { const r = document.querySelector("#cMoreMenu .menu-list").getBoundingClientRect(), s = document.querySelector("#cMoreMenu > summary").getBoundingClientRect(), x = r.left > 60 ? 20 : innerWidth - 20; for (let y = 80; y < innerHeight - 100; y += 20) { const el = document.elementFromPoint(x, y); if (el && !el.closest("#cMoreMenu") && !el.closest("nav")) return [x, y]; } return [x, 80]; });
  await p.mouse.click(away[0], away[1]); await p.waitForTimeout(80); R.outside = await p.$eval("#cMoreMenu", e => e.open);
  await p.click("#cMoreMenu > summary"); await p.keyboard.press("Escape"); R.esc = await p.$eval("#cMoreMenu", e => e.open);
  await p.evaluate(() => { SYNC.cfg = { gist: "test" }; SYNC.err = "GitHub returned 403"; syncBadge(); SYNC.cfg = null; }); R.flag = await p.$eval("#cMoreMenu summary", e => e.textContent.trim());
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); return R;
}
(async () => {
  // one local server for every run, and only once it answers (starting one per run on the same port could race the
  // previous one shutting down on a slow machine, leaving a blank page and a timeout)
  const srv = spawn("python3", ["-m", "http.server", "8808", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:8808/app_real.html")).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  process.on("exit", () => srv.kill());
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "moremenu_phone.png"], ["short phone (menu opens upward)", Object.assign({}, devices["Pixel 7"], { viewport: { width: 412, height: 560 } })]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(J(R.front) === '["Select","⋯ More"]', `${label}: only Select and ⋯ More sit above the list ${J(R.front)}`);
    ok(J(R.items) === '["Update prices","Import CSV","Value breakdown","Duplicates","Sealed products","Price alerts","Backup / export","Sync"]', `${label}: the menu holds the other tools ${J(R.items)}`);
    ok(J(R.afterPick) === "[false,true]", `${label}: picking one opens it and closes the menu ${J(R.afterPick)}`);
    ok(R.outside === false && R.esc === false, `${label}: a tap elsewhere or Escape closes the menu`);
    ok(R.flag === "⋯ More ⚠", `${label}: a sync problem shows on the menu button (${R.flag})`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
  srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
