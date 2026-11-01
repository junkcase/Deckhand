const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, id) => ({ object: "card", id, oracle_id: "o" + id, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" } });
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8773", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const M = { fail: 0, busy: 0, down: false, names: true, slow: 250, reqs: [] };
  await p.route("https://api.scryfall.com/**", async route => {
    const u = decodeURIComponent(route.request().url()); M.reqs.push(u);
    const J = (j, st = 200) => route.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return M.names ? J({ data: ["Sol Ring", "Sol Talisman", "Lightning Bolt"] }) : J({}, 503);
    if (u.endsWith("/sets")) return J({ data: [] });
    if (u.includes("/cards/collection")) { await new Promise(r => setTimeout(r, M.slow)); return J({ data: [], not_found: [] }); }
    if (/named\?(exact|fuzzy)=/.test(u)) {
      if (M.down) return route.abort("failed");
      if (M.fail > 0) { M.fail--; return route.abort("connectionreset"); }
      if (M.busy > 0) { M.busy--; return J({ object: "error", details: "Too many requests" }, 429); }
      const q = u.match(/(?:exact|fuzzy)=([^&]+)/)[1].toLowerCase();
      if (q.startsWith("sol r")) return J(C("Sol Ring", "sol")); if (q.startsWith("lightning")) return J(C("Lightning Bolt", "bolt"));
      return J({ object: "error", details: `No cards found matching “${q}”` }, 404);
    }
    if (u.includes("/cards/search")) return J({ data: [C("Sol Ring", "sol")], has_more: false, total_cards: 1 });
    return J({ object: "error", details: "not mocked" }, 404);
  });
  await p.goto("http://127.0.0.1:8773/app_real.html"); await p.waitForTimeout(800);
  await p.evaluate(() => { S.settings.openAfterAdd = false; S.decks.d1 = { id: "d1", name: "Test", format: "casual", cmdr: [], cards: {}, created: 1, updated: 1 }; go("decks", "d1"); });
  const n = () => p.evaluate(() => Object.values(S.decks.d1.cards).reduce((a, c) => a + c.qty, 0));
  const toastTxt = () => p.evaluate(() => document.querySelector("#toastRoot").textContent);
  const add = async (text, key) => { await p.fill("#dAdd", ""); await p.click("#dAdd"); await p.keyboard.type(text); await p.waitForTimeout(400); if (key) await p.keyboard.press(key); else await p.click("#dAc button"); };
  // 1. a long price update running in the background (90 requests)
  await p.evaluate(() => { for (let i = 0; i < 90; i++) sf("/cards/collection", { identifiers: [{ id: "x" + i }] }).catch(() => {}); });
  let t0 = Date.now(); await add("Sol R"); while (await n() < 1 && Date.now() - t0 < 30000) await p.waitForTimeout(50);
  ok(await n() === 1 && Date.now() - t0 < 2500, `card added in ${((Date.now() - t0) / 1000).toFixed(1)} s while a 90-request price update is running (was: waits behind it, ~20+ s)`);
  // 2. dropped connection, then works
  M.fail = 1; await add("Sol R"); t0 = Date.now(); while (await n() < 2 && Date.now() - t0 < 4000) await p.waitForTimeout(50);
  ok(await n() === 2, "a dropped connection is retried and the card is added");
  // 3. Scryfall says slow down
  // 3. Scryfall says slow down: that's a 30-second block, so say so instead of hammering it, then work again once it's over
  M.busy = 1; const r0 = M.reqs.length; await add("Sol R"); await p.waitForTimeout(1500);
  const msg = await toastTxt(), tries = M.reqs.slice(r0).filter(u => /named\?/.test(u)).length;
  ok(await n() === 2 && /pausing requests from this connection for about 30 seconds/.test(msg) && tries === 1, `'too many requests' from Scryfall: explained, not retried into the block (${tries} request)`);
  const pause = await p.evaluate(() => sfPauseUntil - Date.now());
  await p.evaluate(() => { sfPauseUntil = sfLast = sfLastSlow = 0; ["pause", "last", "slow"].forEach(k => localStorage.removeItem("dh-sf-" + k)); });          // as if the 30 seconds had passed
  await add("Sol R"); t0 = Date.now(); while (await n() < 3 && Date.now() - t0 < 4000) await p.waitForTimeout(50);
  ok(pause > 25000 && await n() === 3, "after the pause, adding works again");
  // 4. type and press Enter with the suggestion list showing
  await add("Lightn", "Enter"); t0 = Date.now(); while (await n() < 4 && Date.now() - t0 < 4000) await p.waitForTimeout(50);
  ok(await n() === 4 && /Added Lightning Bolt/.test(await toastTxt()), "type part of a name and press Enter: adds the top suggestion");
  // 5. Enter with no suggestion list (name list didn't load)
  await p.evaluate(() => { NAMES = null; NAMES_N = null; }); M.names = false;
  await p.fill("#dAdd", ""); await p.click("#dAdd"); await p.keyboard.type("lightning bolt"); await p.evaluate(() => document.querySelector("#dAc").hidden = true); await p.keyboard.press("Enter"); t0 = Date.now(); while (await n() < 5 && Date.now() - t0 < 4000) await p.waitForTimeout(50);
  ok(await n() === 5, "full name + Enter with no list showing: looked up and added");
  // 6. Scryfall unreachable: says why
  M.down = true; await add("Sol R", "Enter").catch(() => {}); t0 = Date.now(); let tt = "";
  while (!/Couldn.t reach|No card found/.test(tt) && Date.now() - t0 < 8000) { await p.waitForTimeout(100); tt = await toastTxt(); }
  ok(/Couldn't reach Scryfall|No card found/.test(tt) && await n() === 5, "Scryfall unreachable: a clear message instead of a bare error: “" + tt + "”");
  M.down = false;
  // 7. Search tab: Enter still runs the search
  await p.evaluate(() => go("search")); await p.waitForTimeout(300);
  const before = M.reqs.length; await p.click("#sq"); await p.keyboard.type("sol"); await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  ok(M.reqs.slice(before).some(u => u.includes("/cards/search") && /q=sol/.test(u)), "Search tab: Enter still searches for what you typed");
  await b.close(); srv.kill();
})();
