const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (id, name, set, num) => ({ id, oracle_id: "o" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: [], color_identity: [], prices: { usd: "2.00" }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const DB = [C("b1", "Lightning Bolt", "2x2", "117"), C("c1", "Counterspell", "mh2", "267")];
async function setup(mode, plan) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
  const canv = []; w.HTMLCanvasElement.prototype.getContext = function () { canv.push(this); return { drawImage() {}, getImageData: (x, y, W, H) => ({ data: new Uint8ClampedArray(W * H * 4).fill(200) }), putImageData() {} }; };
  w.fetch = async (u, o) => { u = decodeURIComponent(String(u)); const J = (j, st = 200) => ({ ok: st === 200, status: st, json: async () => j });
    if (u.includes("/cards/collection")) { (w.__posts = w.__posts || []).push(1); const ids = JSON.parse(o.body).identifiers; return J({ data: ids.map(i => DB.find(c => i.collector_number ? c.set === i.set && c.collector_number === i.collector_number : c.name === i.name && (!i.set || c.set === i.set))).filter(Boolean) }); }
    if (u.includes("card-names")) return J({ data: DB.map(c => c.name) });
    let m = u.match(/\/cards\/(\w+)\/(\w+)$/); if (m) { const c = DB.find(c => c.set === m[1] && c.collector_number === m[2]); return c ? J(c) : J({}, 404); }
    m = u.match(/named\?exact=([^&]+)/); if (m) { const c = DB.find(c => c.name === m[1]); return c ? J(c) : J({}, 404); }
    return J({}, 404); };
  const nameQ = plan.map(p => p[0]), infoQ = plan.map(p => p[1]); let reads = 0;
  w.Tesseract = { createWorker: async (l, o, opts) => { const idx = w.__wk = (w.__wk || 0) + 1; return { setParameters: async () => {}, recognize: async () => { if (idx === 1) reads++; for (const p of [0.5, 1]) { opts.logger({ status: "recognizing text", progress: p }); await new Promise(r => setTimeout(r, 10)); } return { data: { text: (idx === 1 ? nameQ : infoQ).shift() || "" } }; } }; } };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";AUTO.guideWait=0;window.T={go,sc,ana,AUTO,autoTick,setStream:v=>stream=v,setSample:f=>sampleCard=f,loadNames,frameStats};");
  await new Promise(r => setTimeout(r, 150));
  const T = w.T; T.go("scan"); T.sc.mode = mode; T.sc.auto = true; T.setStream({ getTracks: () => [] }); await T.loadNames();
  const vid = w.document.querySelector("#vid"); Object.defineProperty(vid, "videoWidth", { value: 1080 }); Object.defineProperty(vid, "videoHeight", { value: 1920 });
  const cam = w.document.querySelector("#cam"); Object.defineProperty(cam, "clientWidth", { value: 400 }); Object.defineProperty(cam, "clientHeight", { value: 540 });
  let now = 0; Object.defineProperty(w.performance, "now", { value: () => now, configurable: true });
  // a card in view whose sharpness score is LOW (like the tablet camera): the old gate would never fire
  const L = new Float32Array(144 * 200).fill(120); T.setSample(() => ({ L, std: 40, text: 50, sharp: 0.6, mean: 130 }));
  const tickFor = async ms => { for (let t = 0; t < ms; t += 120) { now += 120; T.autoTick(); await new Promise(r => setTimeout(r, 0)); while (T.sc.busy || T.ana.shooting) await new Promise(r => setTimeout(r, 20)); } };
  return { w, T, tickFor, reads: () => reads, canv };
}
(async () => {
  let { w, T, tickFor, reads } = await setup("ask", [["Lightnlng Bolt", "0117/332 U\n2X2 • EN"]]);
  await tickFor(900); await new Promise(r => setTimeout(r, 600));
  ok(reads() === 1 && T.sc.items.at(-1) && T.sc.items.at(-1).card.name === "Lightning Bolt", "low 'sharpness' camera: still takes a snapshot and reads the card (" + reads() + " read)");
  ok(T.sc.items.at(-1).exact, "exact printing from the set code");
  // fails twice, then reads: retries happen on their own with fresh snapshots
  ({ w, T, tickFor, reads } = await setup("any", [["xq", ""], ["zz", ""], ["Counterspel", "0267 U\nMH2 • EN"]]));
  for (let k = 0; k < 12 && reads() < 3; k++) { await tickFor(360); await new Promise(r => setTimeout(r, 400)); }
  await new Promise(r => setTimeout(r, 400));
  ok(reads() === 3, `couldn't read → tried again automatically: ${reads()} reads`);
  ok(T.sc.items.length === 1 && T.sc.items[0].state === "added" && T.sc.items[0].card.name === "Counterspell", "third try found it and (hands-free) added it");
  ok(!T.ana.armed, "then waits for the next card instead of re-reading the same one");
  // never readable: gives up after 4 tries and says so
  ({ w, T, tickFor, reads } = await setup("ask", [["xq", ""], ["xq", ""], ["xq", ""], ["xq", ""], ["xq", ""]]));
  for (let k = 0; k < 20 && reads() < 4; k++) { await tickFor(360); await new Promise(r => setTimeout(r, 300)); }
  await tickFor(1200);
  ok(reads() === 4 && /Couldn't read that one/.test(w.document.querySelector("#camHint").textContent), `unreadable card: stops after ${reads()} tries and asks you to type it`);
})();
