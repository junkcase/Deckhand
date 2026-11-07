// Sync: a deck changed on two devices keeps both devices' edits (card by card, field by field), and both devices end up the same.
const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8822", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await b.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.route("https://**", r => r.fulfill({ status: 404, body: "{}" }));
  await p.goto("http://127.0.0.1:8822/app_real.html"); await p.waitForTimeout(500);
  const R = await p.evaluate(() => {
    const J = o => JSON.parse(JSON.stringify(o)), c = (id, q) => ({ id, name: id, qty: q, side: false });
    const base = pickSync(S); base.coll = {}; base.decks = { d: { id: "d", name: "Deck", format: "commander", cmdr: ["a|0"], theme: "tokens", cards: { "a|0": c("a", 1), "b|0": c("b", 1), "x|0": c("x", 2) }, updated: 100 } };
    const both = (phoneEdit, tabletEdit) => { const ph = J(base), tb = J(base); phoneEdit(ph.decks.d); ph.decks.d.updated = 200; tabletEdit(tb.decks.d); tb.decks.d.updated = 300;
      const m1 = mergeSync(J(base), ph, tb).decks.d, m2 = mergeSync(J(base), tb, ph).decks.d; return { m1, m2, same: J_(m1) === J_(m2) }; };
    const q = d => Object.fromEntries(Object.entries(d.cards).map(([k, v]) => [k.split("|")[0], v.qty]));
    const out = {};
    let r = both(d => { d.cards["c|0"] = c("c", 1); }, d => { d.cards["b|0"].qty = 3; }); out.diffCards = [q(r.m1), r.same];
    r = both(d => { d.cards["x|0"].qty = 3; }, d => { d.cards["x|0"].qty = 4; }); out.sameCard = [q(r.m1).x, r.same];
    r = both(d => { delete d.cards["b|0"]; }, d => { d.cards["c|0"] = c("c", 2); }); out.removeAdd = [q(r.m1), r.same];
    r = both(d => { d.cards["n|0"] = c("n", 1); }, d => { d.cards["n|0"] = c("n", 2); }); out.bothAdd = [q(r.m1).n, r.same];
    r = both(d => { d.name = "Renamed on phone"; }, d => { d.format = "casual"; }); out.fields = [r.m1.name, r.m1.format, r.m1.theme, r.same];
    r = both(d => { d.name = "Phone name"; }, d => { d.name = "Tablet name"; }); out.bothRename = [r.m1.name, r.same];
    r = both(d => { delete d.cards["a|0"]; }, d => { d.cards["b|0"].qty = 2; }); out.cmdrGone = [r.m1.cmdr, q(r.m1)];
    r = both(d => {}, d => {}); out.nothing = r.m1 === undefined ? "missing" : q(r.m1);
    // deleted on one device, edited on the other: kept (as before)
    const ph = J(base), tb = J(base); delete ph.decks.d; tb.decks.d.cards["b|0"].qty = 5; tb.decks.d.updated = 300; out.delVsEdit = !!mergeSync(J(base), ph, tb).decks.d;
    return out;
  });
  const J = JSON.stringify;
  ok(J(R.diffCards) === '[{"a":1,"b":3,"x":2,"c":1},true]', `different cards edited on each device: both kept, both devices the same ${J(R.diffCards)}`);
  ok(J(R.sameCard) === "[5,true]", `the same card's count changed on both (2→3 and 2→4): both changes added up (+1 +2 = 5) ${J(R.sameCard)}`);
  ok(J(R.removeAdd) === '[{"a":1,"x":2,"c":2},true]', `one removes a card while the other adds one: both happen ${J(R.removeAdd)}`);
  ok(J(R.bothAdd) === "[2,true]", `the same new card added on both: once, at the larger count ${J(R.bothAdd)}`);
  ok(J(R.fields) === '["Renamed on phone","casual","tokens",true]', `name changed on one, format on the other: both kept ${J(R.fields)}`);
  ok(J(R.bothRename) === '["Tablet name",true]', `renamed on both: the later rename wins ${J(R.bothRename)}`);
  ok(J(R.cmdrGone) === '[[],{"b":2,"x":2}]', `the commander card removed on one device: no longer listed as commander ${J(R.cmdrGone)}`);
  ok(R.delVsEdit, "a deck deleted on one device but edited on the other is kept, as before");
  ok(!errs.length, `no errors ${J(errs)}`);
  await b.close(); srv.kill();
})();
