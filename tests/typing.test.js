// Typing in a deck's Add a card box (or any box) isn't cut off when something updates the screen in the background:
// card details arriving, a sync, a price update. The update waits until you leave the box, and any redraw keeps the text.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const card = (id, name) => ({ object: "card", id, oracle_id: "o" + id, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", oracle_text: "{T}: Add {C}{C}.", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/s.png", normal: "https://cards.scryfall.io/n.png" } });
async function run(opts) {
  const srv = spawn("python3", ["-m", "http.server", "8801", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = []; let release;
  const gate = new Promise(r => release = r);
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", async r => { const u = r.request().url(), H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: H });
    if (u.includes("/cards/collection")) { await gate; const ids = JSON.parse(r.request().postData()).identifiers; return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: ids.map(i => card(i.id, "Card " + i.id)), not_found: [] }) }); }
    if (u.includes("card-names")) return r.fulfill({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ data: ["Sol Ring", "Solemn Simulacrum"] }) });
    return r.fulfill({ status: 404, headers: H, body: "{}" }); });
  await p.goto("http://127.0.0.1:8801/app_real.html"); await p.waitForTimeout(500);
  // a deck whose cards still need their details (rules text, roles): opening it starts that lookup
  await p.evaluate(() => { const cards = {}; for (const id of ["a1", "a2", "a3"]) cards[id + "|0"] = { id, name: "Card " + id, set: "cmm", num: "1", qty: 1, type: "Artifact", cmc: 1, prices: { usd: "1" }, img: "", finishes: ["nonfoil"] };
    S.decks.k = { id: "k", name: "Kiora", format: "commander", cmdr: [], cards, created: 1, updated: 1 }; save(); go("decks", "k"); });
  await p.waitForTimeout(300);
  const R = {};
  await p.click("#dAdd"); await p.evaluate(() => { window.__b0 = document.querySelector("#dAdd"); }); await p.keyboard.type("Sol", { delay: 60 });
  R.beforeDetails = await p.evaluate(() => window.__b0 === document.querySelector("#dAdd"));
  release(); await p.waitForTimeout(600);                                     // the details arrive while you're typing
  await p.keyboard.type("emn", { delay: 60 });
  R.typing = await p.evaluate(() => ({ val: document.querySelector("#dAdd").value, focus: document.activeElement && document.activeElement.id, same: window.__b0 === document.querySelector("#dAdd"), roles: Object.values(S.decks.k.cards).every(c => c.roles) }));
  // a sync landing mid-typing: the screen waits
  await p.evaluate(() => { window.__box = document.querySelector("#dAdd"); applySynced(Object.assign(pickSync(S), { decks: Object.assign({}, S.decks, { z: { id: "z", name: "From tablet", format: "casual", cmdr: [], cards: {}, created: 2, updated: 2 } }) }), "tablet"); });
  await p.keyboard.type(" S", { delay: 40 }); await p.waitForTimeout(200);
  R.sync = await p.evaluate(() => ({ val: document.querySelector("#dAdd").value, focus: document.activeElement && document.activeElement.id, same: window.__box === document.querySelector("#dAdd"), got: !!S.decks.z }));
  // leaving the box lets the waiting update draw
  await p.evaluate(() => { document.querySelector("#dAdd").value = ""; document.activeElement.blur(); }); await p.waitForTimeout(400);
  R.after = await p.evaluate(() => ({ redrawn: window.__box !== document.querySelector("#dAdd"), text: document.querySelector("#viewTitle").textContent.includes("Kiora") }));
  // and a redraw that does happen while typing keeps the text, cursor and focus
  await p.click("#dAdd"); await p.keyboard.type("Lightn"); await p.evaluate(() => { const i = document.querySelector("#dAdd"); i.setSelectionRange(3, 3); render(); });
  R.kept = await p.evaluate(() => { const i = document.querySelector("#dAdd"); return { val: i.value, focus: document.activeElement === i, caret: i.selectionStart }; });
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["Pixel 7"]]]) {
    const R = await run(opts);
    ok(R.typing.val === "Solemn" && R.typing.focus === "dAdd" && R.typing.same && R.beforeDetails, `[${label}] card details arriving while typing don't interrupt it ${JSON.stringify(R.typing)}`);
    ok(R.sync.val === "Solemn S" && R.sync.focus === "dAdd" && R.sync.same && R.sync.got, `[${label}] a sync arriving while typing is saved but the screen waits (same box, keyboard stays) ${JSON.stringify(R.sync)}`);
    ok(R.after.redrawn && R.after.text, `[${label}] leaving the box lets the update show`);
    ok(R.kept.val === "Lightn" && R.kept.focus && R.kept.caret === 3, `[${label}] a redraw while typing keeps the text, the cursor and the focus ${JSON.stringify(R.kept)}`);
    ok(!R.errs.length, `[${label}] no errors ${JSON.stringify(R.errs)}`);
  }
})();
