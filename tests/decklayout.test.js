// Deck screen: the Add box comes first; format problems are a badge that opens the list; the mana curve and test draws
// fold into one section (closed until opened, remembered); the card list starts on the first screen of a phone.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8809", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8809/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { const cards = {}; for (let i = 0; i < 40; i++) cards["c" + i + "|0"] = { id: "c" + i, name: "Card " + i, type: i < 15 ? "Basic Land — Forest" : "Creature — Elf", set: "tst", num: String(i), qty: 1, cmc: i % 6, side: false, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: { modern: "legal" }, roles: [], colors: ["G"] };
    cards["bad|0"] = { id: "bad", name: "Banned Thing", type: "Artifact", set: "tst", num: "99", qty: 1, cmc: 2, side: false, prices: { usd: "1" }, img: "", finishes: ["nonfoil"], leg: { modern: "banned" }, roles: [] };
    S.decks.d = { id: "d", name: "Layout", format: "modern", cmdr: [], cards, created: 1, updated: 1 }; save(); go("decks", "d"); });
  await p.waitForTimeout(600);
  const R = {};
  const top = sel => p.$eval(sel, e => Math.round(e.getBoundingClientRect().top)).catch(() => null);
  R.order = [await top("#dAdd"), await top("#dFmtBox"), await top("#dStats"), await top("#dl")];
  R.listOnScreen = await p.evaluate(() => { const r = document.querySelector("#dl .item"); return r ? r.getBoundingClientRect().top < innerHeight : false; });
  R.chip = await p.$eval("#dIssues", e => e.textContent.trim()).catch(() => null);
  R.listHidden = await p.$eval("#dIssueList", e => e.hidden);
  R.issueText = await p.$eval("#dIssueList", e => e.textContent);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  await p.click("#dIssues"); await p.waitForTimeout(150); R.opened = [await p.$eval("#dIssueList", e => e.hidden), await p.$eval("#dIssues", e => e.textContent.trim()), await p.evaluate(() => S.meta.deckIssuesOpen)];
  R.stats = [await p.$eval("#dStats", e => e.open), await p.$eval("#dStats summary", e => e.textContent.replace(/\s+/g, " ").trim())];
  await p.click("#dStats summary"); await p.waitForTimeout(150); R.statsOpen = [await p.$eval("#dStats", e => e.open), await p.evaluate(() => S.meta.deckStatsOpen), await p.isVisible(".curve")];
  await p.evaluate(() => { go("coll"); go("decks", "d"); }); await p.waitForTimeout(300); R.kept = [await p.$eval("#dStats", e => e.open), await p.$eval("#dIssueList", e => e.hidden)];
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"], "decklayout_phone.png"]]) {
    const R = await run(opts, shot), J = JSON.stringify;
    ok(R.order.every(Boolean) && R.order[0] < R.order[1] && R.order[1] < R.order[2] && R.order[2] < R.order[3], `${label}: Add box, then format, then curve & test draws, then the card list ${J(R.order)}`);
    ok(R.listOnScreen, `${label}: the card list starts on the first screen`);
    ok(R.chip === "1 problem ▾" && R.listHidden && /need at least 60 cards.*You have 41/.test(R.issueText), `${label}: problems are a badge; the list is there but closed ${J([R.chip, R.listHidden, R.issueText])}`);
    ok(J(R.opened) === '[false,"1 problem ▴",true]', `${label}: tapping the badge opens the list, remembered ${J(R.opened)}`);
    ok(R.stats[0] === false && /^Mana curve & test draws 26 spells · average/.test(R.stats[1]), `${label}: curve & test draws closed, with a summary ${J(R.stats)}`);
    ok(J(R.statsOpen) === "[true,true,true]" && J(R.kept) === "[true,false]", `${label}: opening it shows the curve and is remembered ${J([R.statsOpen, R.kept])}`);
    ok(!R.overflow && !R.errs.length, `${label}: no overflow or errors ${J(R.errs)}`);
  }
})();
