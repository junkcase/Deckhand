const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name, set, num, extra = {}) => Object.assign({ id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "s-" + id, normal: "n-" + id } }, extra);
const sol = P("sol", "Sol Ring", "cmm", "1"), bolt = P("bolt", "Lightning Bolt", "2x2", "2");
const delver = P("delver", "Delver of Secrets // Insectile Aberration", "isd", "51", { layout: "transform", image_uris: undefined, card_faces: [{ name: "Delver of Secrets", image_uris: { small: "s-front", normal: "n-front" } }, { name: "Insectile Aberration", image_uris: { small: "s-back", normal: "n-back" } }] });
const bushi = P("bushi", "Bushi Tenderfoot // Kenzo the Hardhearted", "chk", "2", { layout: "flip", card_faces: [{ name: "Bushi Tenderfoot" }, { name: "Kenzo the Hardhearted" }] });
const old = P("old", "Brutal Cutthroat // Discreet Retreat", "mh3", "9", { layout: "modal_dfc", image_uris: undefined, card_faces: [{ name: "Brutal Cutthroat", image_uris: { small: "s-of", normal: "n-of" } }, { name: "Discreet Retreat", image_uris: { small: "s-ob", normal: "n-ob" } }] });
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {}; w.indexedDB = new IDBFactory();
  const looked = [];
  w.fetch = async u => { u = decodeURIComponent(String(u)); const J = j => ({ ok: true, status: 200, json: async () => j });
    if (/\/cards\/old$/.test(u)) { looked.push(u); return J(old); }
    return { ok: false, status: 404, json: async () => ({}) }; };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={S:()=>S,addToColl,slim,go,openCard,binderSheet,defaultBinder,closeSheet};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T, $ = s => w.document.querySelector(s), S = () => T.S(), click = el => el.dispatchEvent(new w.Event("click", { bubbles: true }));
  const where = () => Object.values(S().coll).map(e => `${e.name.split(" ")[0]}${e.qty}@${S().binders[e.binder] ? S().binders[e.binder].name : "??"}`).sort().join(", ");
  T.addToColl(T.slim(sol), "nonfoil", 3, "main"); T.addToColl(T.slim(bolt), "nonfoil", 2, "trade");

  // ---- delete the main Collection binder, moving its cards
  T.go("coll"); T.binderSheet();
  ok(!!$('[data-del="main"]'), "the Collection binder has a Delete button too");
  click($('[data-del="main"]'));
  const sel = $("#bw-main"); ok(sel && [...sel.options].map(o => o.textContent).join("|") === "Move to Trade binder|Move to Wishlist|Delete them too", "asks where its 3 cards go: " + (sel && [...sel.options].map(o => o.textContent).join(" | ")));
  sel.value = "trade"; click($('[data-yes="main"]'));
  ok(!S().binders.main && where() === "Lightning2@Trade binder, Sol3@Trade binder", "Collection deleted, cards moved: " + where());
  ok(/Deleted “Collection”, moved 3 cards/.test($("#toast") ? $("#toast").textContent : w.document.body.textContent), "says what happened, with Undo");

  click(w.document.querySelector("#toastAct"));
  ok(S().binders.main && where() === "Lightning2@Trade binder, Sol3@Collection", "Undo brings the binder and its cards back: " + where());
  click($('[data-del="main"]')); $("#bw-main").value = "trade"; click($('[data-yes="main"]'));
  // ---- delete the rest, including the cards
  click($('[data-del="trade"]')); $("#bw-trade").value = ""; click($('[data-yes="trade"]'));
  ok(!S().binders.trade && Object.keys(S().coll).length === 0, "Trade binder deleted together with its cards");
  click($('[data-del="wish"]')); click($('[data-yes="wish"]'));
  ok(Object.keys(S().binders).length === 0 && /No binders/.test($("#bBody").textContent), "every binder can be deleted: " + Object.keys(S().binders).length + " left");
  T.closeSheet(); T.go("coll");
  // ---- with no binders, adding a card makes a new Collection
  T.addToColl(T.slim(sol), "nonfoil", 1);
  ok(Object.values(S().binders).map(b => b.name).join() === "Collection" && where() === "Sol1@Collection", "no binders left: a new card goes into a new “Collection” binder (" + where() + ")");

  // ---- both sides of a card
  T.openCard(T.slim(delver));
  let imgs = [...w.document.querySelectorAll("#faces img")].map(i => i.getAttribute("src"));
  ok(imgs.join() === "n-front,n-back", "two-sided card shows front and back side by side: " + imgs.join(", "));
  click(w.document.querySelectorAll("#faces img")[1]); ok($("#faces").dataset.solo === "1", "tap the back to enlarge it");
  click(w.document.querySelectorAll("#faces img")[1]); ok($("#faces").dataset.solo === "", "tap again to go back to both");
  T.closeSheet(); T.openCard(T.slim(bushi));
  const fl = w.document.querySelectorAll("#faces img");
  ok(fl.length === 2 && fl[1].classList.contains("turned") && /Normal and flipped/.test($("#sheetBody").textContent), "flip card shows the picture the right way and turned over");
  T.closeSheet(); T.openCard(T.slim(sol)); ok(!$("#faces") && $("#bigImg"), "ordinary card: one picture as before");
  // a two-sided card saved before backs were kept (no back image, no layout)
  T.closeSheet(); const sl = T.slim(old); delete sl.imgB; delete sl.layout; sl.img = "s-of"; sl.imgN = "n-of";
  T.addToColl(sl, "nonfoil", 1); const entry = Object.values(S().coll).find(e => e.id === "old");
  T.openCard(entry); await new Promise(r => setTimeout(r, 400));
  imgs = [...w.document.querySelectorAll("#faces img")].map(i => i.getAttribute("src"));
  ok(looked.length === 1 && imgs.join() === "n-of,n-ob", "card already in the collection: back looked up once, then shown: " + imgs.join(", ") + " (lookups " + looked.length + ")");
  ok(Object.values(S().coll).find(e => e.id === "old").imgB === "n-ob", "…and remembered, so it isn't looked up again");
})();
