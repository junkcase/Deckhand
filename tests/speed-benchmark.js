// Deckhand at full size: 6,424-card collection, 60-day price history, 6 decks, on a CPU slowed 4x (tablet-ish)
const { chromium } = require("playwright"); const { spawn } = require("child_process");
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8778", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 800, height: 1280 } });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8778/app_real.html"); await p.waitForTimeout(500);
  const cdp = await p.context().newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.argv[2] || 4) });
  const res = await p.evaluate(async () => {
    const T = {}, time = async (k, f) => { const t0 = performance.now(); await f(); T[k] = Math.round(performance.now() - t0); };
    // build a realistic collection
    const R = ["common", "uncommon", "rare", "mythic"], t = today();
    for (let i = 0; i < 6424; i++) {
      const c = { object: "card", id: "id" + i, oracle_id: "o" + (i % 3000), name: "Card Name Number " + (i % 3000), set: "s" + (i % 120), set_name: "Set " + (i % 120), collector_number: String(i), rarity: R[i % 4], type_line: i % 5 ? "Creature — Elf" : "Instant",
        cmc: i % 7, mana_cost: "{2}{G}", colors: ["G"], color_identity: ["G"], prices: { usd: (i % 50 + 0.5).toFixed(2), usd_foil: (i % 30 + 1).toFixed(2) }, finishes: ["nonfoil", "foil"],
        legalities: { commander: "legal", standard: "not_legal", modern: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/front/a/b/id${i}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/id${i}.jpg` }, oracle_text: "When this enters, draw a card. {T}: Add {G}." };
      const sl = slim(c), k = ckey(sl.id, "nonfoil", i % 9 ? "main" : "trade");
      S.coll[k] = Object.assign(sl, { finish: "nonfoil", qty: 1 + (i % 3), binder: i % 9 ? "main" : "trade", added: Date.now() });
      S.ph[pkey(sl.id, "nonfoil")] = Array.from({ length: 30 }, (_, j) => [t - 30 + j, +(i % 50 + j * 0.01).toFixed(2)]);
    }
    for (let d = 0; d < 6; d++) { const id = "d" + d; S.decks[id] = { id, name: "Deck " + d, format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 };
      for (let j = 0; j < 100; j++) { const e = S.coll[Object.keys(S.coll)[d * 100 + j]]; addToDeck(S.decks[id], e, 1, false, true); } }
    S.meta.pricedAt = Date.now();
    await time("save (write to device storage)", () => flushSave());
    await time("collection screen (All owned)", () => { cv.binder = "all"; go("coll"); });
    await time("collection screen again (e.g. after a change)", () => renderColl());
    await time("filter the list while typing", () => { cv.q = "Number 12"; drawCollList(); });
    cv.q = "";
    await time("open a card", () => { const e = Object.values(S.coll)[5]; openCard(e, e.finish, e.binder); closeSheet(); });
    await time("open a deck (Cards tab)", () => go("decks", "d0"));
    await time("deck list", () => go("decks"));
    const st = JSON.parse(JSON.stringify(pickSync(S)));
    await time("sync: nothing changed anywhere (common case)", () => { SYNC.lastJ = J_(pickSync(S)); J_(pickSync(S)) === SYNC.lastJ; });
    const R2 = JSON.parse(JSON.stringify(st)); R2.decks.d0.name = "Renamed on the phone";
    await time("sync: other device renamed a deck", () => { const m = mergeSync(st, pickSync(S), R2); J_(m) !== J_(R2); SYNC_KEYS.some(k => J_(m[k]) !== J_(pickSync(S)[k])); });
    const R3 = JSON.parse(JSON.stringify(st)); for (const k in R3.coll) { R3.coll[k].prices = { usd: "9.99" }; } const L3 = JSON.parse(JSON.stringify(st)); L3.coll[Object.keys(L3.coll)[0]].qty += 1;
    await time("sync: both sides changed the collection", () => { const m = mergeSync(st, L3, R3); J_(m) !== J_(R3); });
    await time("sync: pack for upload", () => packState(pickSync(S)));
    T["sync upload size (MB)"] = +((await packState(pickSync(S))).length / 1e6).toFixed(2);
    T["state size (MB, uncompressed)"] = +(JSON.stringify(S).length / 1e6).toFixed(1);
    await time("movers", () => moversHTML());
    return T;
  });
  for (const [k, v] of Object.entries(res)) console.log(String(v).padStart(8), " ", k);
  await b.close(); srv.kill();
})();
