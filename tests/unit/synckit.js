// Shared kit for the sync tests that run without a browser: the app in jsdom with a test database, a pretend GitHub,
// a pretend Google Drive, and a localStorage that several "tabs" can share. Nothing here talks to a real service.
const { JSDOM } = require("jsdom"); const fs = require("fs"); const { IDBFactory } = require("fake-indexeddb");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const P = (id, name, set, num) => ({ id, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const sol = P("sol", "Sol Ring", "cmm", "1"), bolt = P("bolt", "Lightning Bolt", "2x2", "2"), cs = P("cs", "Counterspell", "mh2", "3"), path = P("path", "Path to Exile", "con", "4");
// ---- a fake GitHub
const GH = { gists: {}, n: 0, calls: [], token: "ghp_good" };
async function github(u, o = {}) {
  const url = new URL(u), m = (o.method || "GET").toUpperCase(), auth = (o.headers || {}).Authorization;
  GH.calls.push(m + " " + url.pathname);
  const J = (j, st = 200, h = {}) => new Response(JSON.stringify(j), { status: st, headers: Object.assign({ "Content-Type": "application/json" }, h) });
  if (auth !== "token " + GH.token) return J({ message: "Bad credentials" }, 401);
  if (url.pathname === "/user") return J({ login: "junkcase" });
  if (url.pathname === "/gists" && m === "GET") return J(Object.values(GH.gists).map(g => ({ id: g.id, description: g.description })));
  if (url.pathname === "/gists" && m === "POST") { const b = JSON.parse(o.body), id = "g" + (++GH.n); GH.gists[id] = { id, description: b.description, files: b.files, etag: '"e' + GH.n + '"' }; return J(GH.gists[id], 201); }
  const g = GH.gists[url.pathname.split("/")[2]]; if (!g) return J({}, 404);
  if (m === "PATCH") { const b = JSON.parse(o.body); for (const [k, v] of Object.entries(b.files)) { if (v === null) delete g.files[k]; else g.files[k] = v; } g.etag = '"e' + (++GH.n) + '"'; if (GH.loseReply) throw new TypeError("Failed to fetch (reply lost)"); return J(g); }
  if ((o.headers || {})["If-None-Match"] === g.etag) return new Response(null, { status: 304, headers: { ETag: g.etag } });
  return J({ id: g.id, files: Object.fromEntries(Object.entries(g.files).map(([k, v]) => [k, GH.metaCut && /sync\.json/.test(k) ? { content: GH.metaCut === "part" ? v.content.slice(0, 20) : "", size: v.content.length, truncated: GH.metaCut !== "blank", raw_url: "https://gist.githubusercontent.com/raw/" + g.id + "/" + k } : GH.truncate && /data/.test(k) ? { content: v.content.slice(0, 50), truncated: true, raw_url: "https://gist.githubusercontent.com/raw/" + g.id + "/" + k } : { content: v.content, truncated: false }])) }, 200, { ETag: g.etag });
}
async function device(name, opt = {}) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://junkcase.github.io/Deckhand/" }); const w = dom.window;
  if (opt.store) { Object.defineProperty(w, "localStorage", { configurable: true, value: opt.store.join(w) }); }
  w.scrollTo = () => {}; w.indexedDB = opt.idb || new IDBFactory(); if (opt.ls) for (const [k, v] of Object.entries(opt.ls)) w.localStorage.setItem(k, v);
  Object.assign(w, { CompressionStream, DecompressionStream, Response, TextEncoder, TextDecoder, structuredClone }); if (opt.nodeBlob) { w.Blob = Blob; w.FormData = FormData; }
  w.fetch = async (u, o) => { if (opt.fetch) { const r = await opt.fetch(String(u), o, w); if (r) return r; } return String(u).startsWith("https://api.github.com") ? github(String(u), o) : String(u).startsWith("https://gist.githubusercontent.com") ? raw(String(u)) : { ok: false, status: 404, json: async () => ({}) }; };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.X={GD,setSyncCfg,syncCfg,gdSignedIn,devId};window.T={S:()=>S,addToColl,slim,connectSync,syncNow,SYNC,save,flushSave,restoreBackup,readRemote,idb,ONE,GDS,syncBase,idbOpen,idbGet,idbSet,setSyncBase,gdReadSync,stop:()=>{clearInterval(SYNC.poll);SYNC.poll=null;clearTimeout(SYNC.t);},toasts:()=>document.querySelector('#toastRoot')?.textContent||''};");
  await new Promise(r => setTimeout(r, 300));
  const T = w.T; T.w = w; T.X = w.X; T.name = name;
  T.cards = () => Object.values(T.S().coll).map(e => `${e.name.split(" ")[0]}×${e.qty}`).sort().join(", ");
  T.sync = async () => { while (T.SYNC.busy) await new Promise(r => setTimeout(r, 20)); await T.syncNow(true); };
  return T;
}

async function raw(u) { const [, , , , id, k] = u.split("/"); const g = GH.gists[id]; const c = g.files[k].content; if (GH.rawFail === "cut") return new Response(c.slice(0, Math.floor(c.length / 2))); if (GH.rawFail === "error") throw new TypeError("network error"); if (GH.rawFail === "404") return new Response("Not Found", { status: 404 }); return new Response(c); }


// one localStorage shared by several tabs of the same browser; a change is announced to the other tabs ("storage" event)
function sharedStore() {
  const m = new Map(), wins = [];
  return { m, wins, join(w) { wins.push(w); return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { v = String(v); const old = m.has(k) ? m.get(k) : null; m.set(k, v); if (old !== v) for (const o of wins) if (o !== w && !o.__closed) setTimeout(() => { if (!o.__closed) o.dispatchEvent(Object.assign(new o.Event("storage"), { key: k, newValue: v, oldValue: old })); }, 0); },
    removeItem: k => { m.delete(k); }, key: i => { const a = [...m.keys()]; return i < a.length ? a[i] : null; }, get length() { return m.size; } }; } };
}
// ---- a pretend Google Drive: one folder; a file's version goes up on every change
const D = { files: {}, n: 0, uploads: 0, fault: null, metaFail: null, offline: {}, gen: 0 };
const DJ = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const drive = who => { const gen = D.gen; return async (u, o = {}) => {
  if (!u.startsWith("https://www.googleapis.com")) return null;
  if (gen !== D.gen) throw new TypeError("a device from an earlier scenario");
  if (D.offline[who]) throw new TypeError("Failed to fetch");
  if (u.includes("/upload/drive/v3/files")) {
    const f = D.fault && D.fault.who === who ? D.fault : null;
    if (f && f.kind === "never") { D.fault = null; throw new TypeError("Failed to fetch"); }                    // the request never arrives
    if (f && f.kind === "500") { D.fault = null; return DJ({ error: { message: "backend" } }, 500); }
    if (f && f.kind === "401") { D.fault = null; return DJ({}, 401); }
    const meta = JSON.parse(await o.body.get("metadata").text()), buf = Buffer.from(await o.body.get("file").arrayBuffer());
    let id = (u.match(/files\/([^?]+)\?/) || [])[1];
    if (!id) { id = "F" + (++D.n); D.files[id] = { id, createdTime: new Date(1e12 + D.n * 1000).toISOString(), parents: meta.parents || ["FOLD"], version: 0 }; }
    const file = D.files[id]; if (!file) return DJ({}, 404);
    file.body = buf; file.version++; file.appProperties = meta.appProperties; D.uploads++;
    if (f && f.kind === "lost") { D.fault = null; throw new TypeError("Failed to fetch"); }                     // arrived, but the reply is lost
    return DJ({ id, version: String(file.version) });
  }
  if (/\/drive\/v3\/files\?q=/.test(u)) return DJ({ files: Object.values(D.files).sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(f => ({ id: f.id, createdTime: f.createdTime, parents: f.parents })) });
  const id = (u.match(/\/drive\/v3\/files\/([^?]+)/) || [])[1], file = D.files[id]; if (!file) return DJ({}, 404);
  if (!/alt=media/.test(u) && D.metaFail && D.metaFail.who === who) { const k = D.metaFail.kind; D.metaFail = null; if (k === "net") throw new TypeError("Failed to fetch"); return DJ({ error: { message: "x" } }, +k); }
  if (/alt=media/.test(u)) return new Response(file.body);
  return DJ({ id, version: String(file.version), trashed: false, size: String(file.body.length), appProperties: file.appProperties });
}; };
const driveReset = () => { D.gen++; D.files = {}; D.n = 0; D.fault = null; D.metaFail = null; D.offline = {}; };
async function driveDevice(name, opt = {}) { const T = await device(name, Object.assign({ fetch: drive(name), nodeBlob: true }, opt)); T.X.GD.tok = "t"; T.X.GD.exp = Date.now() + 3600e3; if (!opt.keepCfg) T.X.setSyncCfg({ kind: "google", folder: "FOLD", file: null }); T.stop(); return T; }
const githubReset = () => { for (const k in GH.gists) delete GH.gists[k]; GH.loseReply = false; GH.metaCut = null; GH.truncate = false; GH.rawFail = null; };
// change how many copies of a card there are (0 removes it), the way the app's own screens do: change, then save()
const setQty = (T, name, q) => { const S = T.S(); for (const k of Object.keys(S.coll)) if (S.coll[k].name === name) { if (q <= 0) delete S.coll[k]; else S.coll[k].qty = q; } T.save(); };
// give a card's entry fixed times, so that two devices adding "the same card" never depend on the clock
const stamp = (T, name, at) => { for (const e of Object.values(T.S().coll)) if (e.name === name) { e.added = at; e.newAt = at; } };
const lsOf = T => { const o = {}; for (let i = 0; i < T.w.localStorage.length; i++) { const k = T.w.localStorage.key(i); o[k] = T.w.localStorage.getItem(k); } return o; };
const lastLog = (T, n = 3) => (T.S().meta.syncLog || []).slice(-n).map(e => e.what).join(" / ");
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = { GH, D, device, driveDevice, driveReset, githubReset, sharedStore, setQty, stamp, lsOf, lastLog, wait, ok, sol, bolt, cs, path, IDBFactory };
