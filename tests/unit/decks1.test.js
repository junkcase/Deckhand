const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name, extra = {}) => Object.assign({ id, oracle_id: "o-" + id, name, set: "cmm", set_name: "CMM", collector_number: "1", rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: "s", normal: "n" } }, extra);
const sol = P("sol", "Sol Ring"), sig = P("sig", "Arcane Signet");
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {}; w.indexedDB = new IDBFactory();
  w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,addToDeck,slim,go,renderDeck,deckMenu,closeSheet,allocFor,deckStats};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T, $ = s => w.document.querySelector(s), S = () => T.S(), wait = ms => new Promise(r => setTimeout(r, ms));
  T.addToColl(T.slim(sol), "nonfoil", 3, "main");
  const mk = (id, name) => { S().decks[id] = { id, name, format: "commander", cmdr: [], cards: {}, created: Date.now() - 864e5 * 3, updated: Date.now() }; return S().decks[id]; };
  const A = mk("a", "Atraxa"), B = mk("b", "Krenko"), C = mk("c", "Kenrith");
  for (const d of [A, B, C]) T.addToDeck(d, T.slim(sol), 1, false); T.addToDeck(C, T.slim(sig), 1, false);
  T.go("decks", "c"); await wait(50);
  const rowOf = n => [...w.document.querySelectorAll("#dl .item")].find(r => r.textContent.includes(n));
  ok(/owned · also in 2 other decks/.test(rowOf("Sol Ring").textContent), "Sol Ring row: owned, and also used in 2 other decks");
  ok(/not owned/.test(rowOf("Arcane Signet").textContent), "Arcane Signet row: not owned");
  let al = T.allocFor("Sol Ring", "c");
  ok(al.own === 3 && al.other === 2 && al.free === 1 && al.missing === 0, `allocation: own ${al.own}, in other decks ${al.other}, free ${al.free}`);
  // each copy belongs to one deck
  S().settings.shareCopies = false; const D = mk("d", "Ur-Dragon"); T.addToDeck(D, T.slim(sol), 1, false);
  T.go("decks", "c"); await wait(50);
  al = T.allocFor("Sol Ring", "c");
  ok(al.free === 0 && al.missing === 1 && /0 of 1 free · rest in other decks/.test(rowOf("Sol Ring").textContent), "sharing off + 4 decks use my 3 Sol Rings: this deck shows 0 of 1 free");
  ok(T.deckStats(C).missing === 2, "…and counts it as missing along with the unowned Signet (" + T.deckStats(C).missing + ")");
  // removing from another deck frees it up immediately
  T.addToDeck(D, T.slim(sol), -1, false); T.go("decks", "c"); await wait(50);
  ok(T.allocFor("Sol Ring", "c").free === 1 && /owned/.test(rowOf("Sol Ring").textContent), "removing it from another deck frees the copy straight away");
  S().settings.shareCopies = true;
  // themes
  $("#dThemeAdd").click(); $("#dThemeIn").value = "Tokens"; $("#dThemeGo").click(); await wait(20);
  $("#dThemeAdd").click(); $("#dThemeIn").value = "My weird combo"; $("#dThemeGo").click(); await wait(20);
  ok(JSON.stringify(S().decks.c.themes) === '["Tokens","My weird combo"]' && /Tokens/.test($("#dThemes").textContent), "add themes from the list or your own: " + S().decks.c.themes.join(", "));
  $('[data-untheme="Tokens"]').click(); await wait(20);
  ok(JSON.stringify(S().decks.c.themes) === '["My weird combo"]', "remove a theme");
  // completion + dates
  ok($(".meter > div").style.width === "2%" && /2\/100|2<span class="small muted">\/100/.test($("#view").innerHTML), "completion: 2 of 100 cards");
  ok(/Started .* changed/.test($("#view").textContent), "shows when the deck was started and last changed");
  // duplicate
  T.deckMenu(S().decks.c); $("#dDup").click(); await wait(50);
  const copy = Object.values(S().decks).find(d => d.name === "Kenrith (copy)");
  ok(copy && copy.id !== "c" && Object.keys(copy.cards).length === 2 && JSON.stringify(copy.themes) === '["My weird combo"]', "duplicate: a separate deck with the same cards and themes");
  copy.cards[Object.keys(copy.cards)[0]].qty = 5;
  ok(Object.values(S().decks.c.cards)[0].qty === 1, "…changing the copy doesn't change the original");
  // deck list
  T.go("decks"); await wait(20);
  ok(/2\/100 cards/.test($("#view").textContent) && /My weird combo/.test($("#view").textContent) && /Changed/.test($("#view").textContent), "deck list shows completion, themes and last change");
})();
