const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (id, name, set, num) => ({ id, oracle_id: "o" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: [], color_identity: [], prices: { usd: "2.00" }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const DB = [C("b1", "Lightning Bolt", "2x2", "117"), C("c1", "Counterspell", "mh2", "267"), C("s1", "Sol Ring", "cmm", "410"), C("h1", "Lightning Helix", "rav", "213"), C("g1", "Lightning Greaves", "cmm", "395")];
const idb = new IDBFactory();
async function page(mode, plan) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {}; w.indexedDB = idb;
  w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {}, getImageData: (x, y, W, H) => ({ data: new Uint8ClampedArray(W * H * 4).fill(200) }), putImageData() {} }; };
  w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,xx";
  w.fetch = async (u, o) => { u = decodeURIComponent(String(u)); const J = (j, st = 200) => ({ ok: st === 200, status: st, json: async () => j });
    if (u.includes("/cards/collection")) { (w.__posts = w.__posts || []).push(1); const ids = JSON.parse(o.body).identifiers; return J({ data: ids.map(i => DB.find(c => i.collector_number ? c.set === i.set && c.collector_number === i.collector_number : c.name === i.name && (!i.set || c.set === i.set))).filter(Boolean) }); }
    if (u.includes("card-names")) return J({ data: DB.map(c => c.name) });
    let m = u.match(/\/cards\/(\w+)\/(\w+)$/); if (m) { const c = DB.find(c => c.set === m[1] && c.collector_number === m[2]); return c ? J(c) : J({}, 404); }
    m = u.match(/named\?exact=([^&]+)/); if (m) { const c = DB.find(c => c.name === m[1]); return c ? J(c) : J({}, 404); }
    return J({}, 404); };
  const nameQ = plan.map(p => p[0]), infoQ = plan.map(p => p[1]);
  w.Tesseract = { createWorker: async (l, o, opts) => { const idx = w.__wk = (w.__wk || 0) + 1; return { setParameters: async () => {}, recognize: async () => { await new Promise(r => setTimeout(r, 10)); return { data: { text: (idx === 1 ? nameQ : infoQ).shift() || "" } }; } }; } };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";AUTO.guideWait=0;window.T={go,sc,ana,autoTick,setStream:v=>stream=v,setSample:f=>sampleCard=f,loadNames,S:()=>S,flushSave};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.go("scan"); T.sc.mode = mode; T.sc.auto = true; T.setStream({ getTracks: () => [] }); await T.loadNames();
  const vid = w.document.querySelector("#vid"); Object.defineProperty(vid, "videoWidth", { value: 1080 }); Object.defineProperty(vid, "videoHeight", { value: 1920 });
  const cam = w.document.querySelector("#cam"); Object.defineProperty(cam, "clientWidth", { value: 400 }); Object.defineProperty(cam, "clientHeight", { value: 540 });
  let now = 0; Object.defineProperty(w.performance, "now", { value: () => now, configurable: true });
  let cardNo = 1; const frame = () => { const L = new Float32Array(144 * 200).fill(60 + cardNo * 37 % 150); return { L, std: 40, text: 50, sharp: 0.6, mean: 130 }; };
  let empty = false; T.setSample(() => empty ? { L: new Float32Array(144 * 200).fill(120), std: 2, text: 1, sharp: 0, mean: 120 } : frame());
  const settle = async () => { for (let i = 0; i < 100 && (T.sc.busy || T.ana.shooting); i++) await new Promise(r => setTimeout(r, 20)); };
  const show = async (n, ticks = 8) => { cardNo = n; empty = false; for (let t = 0; t < ticks; t++) { now += 120; T.autoTick(); await new Promise(r => setTimeout(r, 0)); await settle(); } empty = true; for (let t = 0; t < 2; t++) { now += 120; T.autoTick(); } };
  return { w, T, show, $: s => w.document.querySelector(s) };
}
(async () => {
  let { w, T, show, $ } = await page("ask", [["Lightnlng Bolt", "0117/332 U\n2X2 • EN"], ["Counterspel", "0267 U\nMH2 • EN"], ["Lightnlng Bolt", "0117/332 U\n2X2 • EN"], ["Lightning", ""], ["xq", ""], ["xq", ""], ["xq", ""], ["xq", ""], ["S0l Ring", ""]]);
  await show(1); await show(2); await show(3);
  ok(T.sc.items.length === 2 && T.sc.items.every(i => i.state === "review"), "3 cards scanned back to back, nothing waited for a tap: " + T.sc.items.map(i => i.card.name + "×" + i.qty).join(", "));
  ok(T.sc.items.find(i => i.card.name === "Lightning Bolt").qty === 2, "the same card scanned twice counts up to ×2 instead of a second row");
  ok(Object.keys(T.S().coll).length === 0, "nothing added to the collection until you choose");
  await show(4);
  ok(T.sc.items.at(-1).state === "pick" && T.sc.items.at(-1).cands.includes("Lightning Helix"), "partial read listed with choices, scanning carried on");
  await show(5, 40);
  ok(T.sc.items.at(-1).state === "failed" && T.sc.items.at(-1).thumb, "unreadable card (after 4 tries) listed with its picture");
  await show(6);
  ok(T.sc.items.at(-1).card && T.sc.items.at(-1).card.name === "Sol Ring", "next card scanned right after");
  const heads = $("#scSession").textContent.replace(/\s+/g, " ");
  ok(/Scanned this session/.test(heads) && /Add all 4/.test(heads), "list header with 'Add all 4': " + (heads.match(/Add all [^)]*\)/) || [""])[0]);
  // choose: pick Helix for the partial read, skip the Counterspell
  w.document.querySelector('[data-pick][data-n="Lightning Helix"]').click(); for (let i = 0; i < 60 && !T.sc.items.some(x => x.card && x.card.name === "Lightning Helix"); i++) await new Promise(r => setTimeout(r, 50));
  const cs = T.sc.items.find(i => i.card && i.card.name === "Counterspell"); w.document.querySelector(`[data-skip="${cs.id}"]`).click();
  w.document.querySelector("#sesAll").click();
  const coll = Object.values(T.S().coll).map(e => e.name + "×" + e.qty).sort().join(", ");
  ok(coll === "Lightning Bolt×2, Lightning Helix×1, Sol Ring×1", "Add all puts the chosen cards in the collection: " + coll);
  ok(Object.values(T.S().coll).every(e => e.scanned), "with their scan dates");
  await T.flushSave();
  // reload: the session list is still there
  ({ w, T } = await page("ask", []));
  ok(T.sc.items.length === 4 && T.sc.items.filter(i => i.state === "added").length === 3, "session list survives closing and reopening the app");
  // hands-free mode still adds as it scans
  ({ w, T, show } = await page("any", [["Counterspel", "0267 U\nMH2 • EN"]]));
  await show(7);
  ok(T.sc.items.at(-1).state === "added" && Object.values(T.S().coll).some(e => e.name === "Counterspell"), "'Add everything automatically' still adds as it scans");
})();
