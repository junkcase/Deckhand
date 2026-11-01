const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const X = n => `"><img src=x onerror="window.PWN=(window.PWN||[]).concat('${n}')">`;
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8779", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.route("https://json.edhrec.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8779/app_real.html"); await p.waitForTimeout(500);
  const bad = await p.evaluate(() => { const X = n => `"><img src=x onerror="window.PWN=(window.PWN||[]).concat('${n}')">`;
    const card = { id: "c1" + X("cardid"), oid: "o", name: "Evil" + X("name"), set: "x" + X("set"), setName: X("setname"), num: "1" + X("num"), rarity: "rare" + X("rarity"), type: "Creature" + X("type"), cmc: 1, mana: "{G}" + X("mana") + "{" + X("manab") + "}",
      colors: ["G"], ci: ["G", X("ci")], img: "x" + X("img"), imgN: "javascript:window.PWN=1", imgB: X("imgB"), layout: "transform", prices: { usd: "1" }, finishes: ["nonfoil" + X("fin")], uri: "javascript:window.PWN=(window.PWN||[]).concat('uri')", leg: { commander: "l" }, roles: ["Ramp" + X("role")], text: X("text"), canCmdr: true, partner: false };
    return { v: 2, meta: {}, settings: {}, roles: { ["Evil" + X("name")]: ["Ramp" + X("rolefix")] }, alerts: {}, ph: {}, hist: [], trade: { give: [], get: [] }, marks: {},
      binders: { ["b" + X("binderid")]: { id: "b" + X("binderid"), name: "Binder" + X("bindername") } },
      coll: { k: Object.assign({}, card, { qty: 2, finish: "nonfoil", binder: "b" + X("binderid") }) },
      decks: { ["d" + X("deckid")]: { id: "d" + X("deckid"), name: "Deck" + X("deckname"), format: "commander", themes: ["Theme" + X("theme")], themeSlugs: {}, cmdr: ["c1" + X("cardid") + "|0"], cards: { ["c1" + X("cardid") + "|0"]: Object.assign({}, card, { qty: 1, side: false }) },
        created: 1, updated: 1, history: [{ id: "h" + X("histid"), at: 1, text: "Hist" + X("histtext"), out: { key: "k", card } }], upg: { keep: ["K" + X("keep")], rejected: ["R" + X("rej") + "→" + X("rej2")], later: [{ cut: X("later"), add: X("later2"), at: 1 }], reports: [] } } },
      scanSession: [{ id: "s" + X("scanid"), state: "review", card, exact: false, conf: "medium" + X("conf"), finish: "foil" + X("sfin"), qty: 1, at: 1 }, { id: "p" + X("pickid"), state: "pick", cands: ["A" + X("cand")], read: X("read"), thumb: "x" + X("thumb"), finish: "nonfoil", qty: 1, at: 1 }, { id: "f" + X("failid"), state: "failed", read: X("failread"), thumb: "", finish: "nonfoil", qty: 1, at: 1 }],
      scanLog: [{ at: 1, try: 1, ok: true, conf: "high" + X("logconf"), result: X("logresult"), read: X("logread"), raw: X("lograw"), set: X("logset"), num: "1", ms: { total: 1 } }] };
  });
  // restore it the way the app does
  await p.evaluate(d => { S = d; migrate(); save(); render(); }, bad);
  const screens = [
    ["collection", () => { cv.binder = "all"; go("coll"); }], ["binder", () => { cv.binder = Object.keys(S.binders)[0]; renderColl(); }], ["binders sheet", () => binderSheet()],
    ["card screen", () => { closeSheet(); const e = Object.values(S.coll)[0]; openCard(e, e.finish, e.binder); }], ["deck list", () => { closeSheet(); go("decks"); }],
    ["deck", () => go("decks", Object.keys(S.decks)[0])], ["deck balance", () => { const id = Object.keys(S.decks)[0]; deckTab[id] = "balance"; renderDeck(S.decks[id]); }],
    ["deck upgrade", () => { const id = Object.keys(S.decks)[0]; deckTab[id] = "upgrade"; renderDeck(S.decks[id]); }],
    ["deck card screen", () => { const d = Object.values(S.decks)[0], k = Object.keys(d.cards)[0]; openCard(d.cards[k], null, null, { deck: d, key: k }); }],
    ["deck options", () => { closeSheet(); deckMenu(Object.values(S.decks)[0]); }], ["sync sheet", () => { closeSheet(); syncSheet(); }], ["trade", () => { closeSheet(); go("trade"); }], ["search", () => go("search")], ["scan", () => { sc.items = S.scanSession; S.meta.logOpen = true; go("scan"); }]];
  for (const [n, f] of screens) { try { await p.evaluate(`(${f.toString()})()`); } catch (e) { console.log("   (", n, "threw:", e.message.slice(0, 80), ")"); } await p.waitForTimeout(1200); }
  await p.evaluate(() => { const a = [...document.querySelectorAll("a")].find(a => /Scryfall/.test(a.textContent)); if (a) a.click(); });
  await p.waitForTimeout(300);
  const pwn = await p.evaluate(() => window.PWN || null), imgs = await p.evaluate(() => document.querySelectorAll('img[src="x"]').length);
  ok(!pwn, "hostile backup: no injected code ran on any screen" + (pwn ? " (ran: " + JSON.stringify(pwn) + ")" : ""));
  ok(imgs === 0, "no injected elements appeared in the page");
  await b.close(); srv.kill();
})();
