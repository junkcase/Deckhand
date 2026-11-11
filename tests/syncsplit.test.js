// Two synced copies (each device made its own): every device settles on the same one, the oldest, and joins its cards
// into it without removing anything. Google Drive and GitHub.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const G = { files: {}, n: 0, gets: 0, media: 0 };          // one Drive shared by both devices
function multipart(req) {
  const body = req.postDataBuffer(), bd = req.headers()["content-type"].split("boundary=")[1];
  const parts = body.toString("latin1").split("--" + bd).filter(x => x.includes("Content-Disposition"));
  return { meta: JSON.parse(parts[0].split("\r\n\r\n")[1].trim()), data: Buffer.from(parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""), "latin1") };
}
async function drive(r) {
  const req = r.request(), u = new URL(req.url()), m = req.method(), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
  if (!/^Bearer tok/.test(req.headers().authorization || "")) return J({ error: { message: "no auth" } }, 401);
  if (u.pathname === "/drive/v3/about") return J({ user: { emailAddress: "friend@gmail.com" } });
  if (u.pathname.startsWith("/upload/drive/v3/files")) {
    const { meta, data } = multipart(req), id = u.pathname.split("/")[5];
    if (id) { const f = G.files[id]; Object.assign(f, meta, { data, version: String(+f.version + 1), size: String(data.length) }); return J({ id, version: f.version }); }
    const nid = "f" + (++G.n); G.files[nid] = Object.assign({ id: nid, createdTime: new Date(Date.now() + G.n).toISOString(), version: "1", size: String(data.length), data }, meta); return J({ id: nid, version: "1" });
  }
  if (u.pathname === "/drive/v3/files" && m === "GET") {
    const q = u.searchParams.get("q"), live = Object.values(G.files).filter(f => !f.trashed);
    if (/mimeType='application\/vnd.google-apps.folder'/.test(q)) { const name = q.match(/name='([^']+)'/)[1]; return J({ files: live.filter(f => f.mimeType === "application/vnd.google-apps.folder" && f.name === name).map(f => ({ id: f.id })) }); }
    const parent = (q.match(/'([^']+)' in parents/) || [])[1], name = (q.match(/name='([^']+)'/) || [])[1];
    return J({ files: live.filter(f => (!parent || (f.parents || []).includes(parent)) && (!name || f.name === name)).sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(({ data, ...f }) => f) });
  }
  if (u.pathname === "/drive/v3/files" && m === "POST") { const meta = JSON.parse(req.postData()), id = "f" + (++G.n); G.files[id] = Object.assign({ id, createdTime: new Date().toISOString(), version: "1" }, meta); return J({ id }); }
  const id = u.pathname.split("/")[4], f = G.files[id]; if (!f) return J({ error: { message: "not found" } }, 404);
  if (m === "PATCH") { Object.assign(f, JSON.parse(req.postData())); return J({ id }); }
  if (u.searchParams.get("alt") === "media") { G.media++; return r.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: f.data }); }
  G.gets++; const { data, ...meta } = f; return J(meta);
}
async function device(b, opts) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://accounts.google.com/gsi/client", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `window.google={accounts:{oauth2:{initTokenClient(c){return{requestAccessToken(){window.__gsi=(window.__gsi||0)+1;setTimeout(()=>c.callback({access_token:"tok"+Date.now(),expires_in:3600}),30);}}}}}};` }));
  await p.route("https://www.googleapis.com/**", drive);
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8837/app_real.html"); await p.waitForTimeout(500);
  p.errs = errs; return p;
}
const card = (id, name) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] });

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8837", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), R = {};
  const cards = p => p.evaluate(() => Object.values(S.coll).map(e => e.name + "×" + e.qty).sort().join(", "));
  const decks = p => p.evaluate(() => Object.values(S.decks).map(d => d.name).sort().join(", "));
  const settle = async (...ps) => { for (const p of ps) await p.evaluate(async () => { for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); await syncNow(true); }); };
  const quiet = p => p.evaluate(() => { clearInterval(SYNC.poll); SYNC.poll = null; clearTimeout(SYNC.t); });
  // ---- Google Drive: the tablet signs in first; the PC ends up with its own file (as if both set up at the same moment)
  const T = await device(b, devices["Pixel 7"]), P = await device(b, { viewport: { width: 1280, height: 900 } });
  await T.evaluate(c => { S.binders = { main: { id: "main", name: "Collection" } }; addToColl(c, "nonfoil", 2, "main"); S.decks.t = { id: "t", name: "Tablet deck", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("coll"); }, card("sol", "Sol Ring"));
  await T.click("#eSync").catch(() => {}); await T.evaluate(() => { if (!document.querySelector("#syGoogle")) syncSheet(); }); await T.waitForSelector("#syGoogle"); await T.click("#syGoogle");
  await T.waitForFunction(() => syncOn() && !SYNC.busy && SYNC.at, null, { timeout: 8000 }); await quiet(T);
  const first = Object.values(G.files).find(f => f.name === "deckhand-sync.json.gz").id;
  // the PC: its own folder and file, with its own cards, already "synced" there
  await P.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; save(); go("coll"); });
  await P.evaluate(() => { if (!document.querySelector("#syGoogle")) syncSheet(); }); await P.waitForSelector("#syGoogle");
  await P.evaluate(() => { ONE.every = 1e12; ONE.at = Date.now(); });              // (keep it from looking while being set up)
  await P.click("#syGoogle"); await P.waitForFunction(() => syncOn() && !SYNC.busy && SYNC.at, null, { timeout: 8000 }); await quiet(P);
  // force the split: a second folder and file only the PC uses
  await P.evaluate(async () => { const f = await (await gd("/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Deckhand sync", mimeType: "application/vnd.google-apps.folder" }) })).json();
    setSyncCfg(Object.assign({}, syncCfg(), { folder: f.id, file: null })); GDS.version = null; S.coll = {}; addToColl({ id: "bolt", oid: "obolt", name: "Lightning Bolt", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Instant", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] }, "nonfoil", 1, "main"); S.decks = {}; S.decks.p = { id: "p", name: "PC deck", format: "commander", cmdr: [], cards: {}, created: 2, updated: 2 }; save();
    await idbSet("syncBase", null); SYNC.base = null; SYNC.dirty = true; await syncNow(true); });
  // the PC's record of what was synced: an older one without the copy it came from (as on devices set up before this fix)
  await P.evaluate(async () => { const b = await syncBase(); delete b.target; await idbSet("syncBase", b); });
  R.twoFiles = Object.values(G.files).filter(f => f.name === "deckhand-sync.json.gz" && !f.trashed).length;
  R.before = [await cards(T), await cards(P), await P.evaluate(() => syncCfg().file) !== first];
  // now each looks for synced copies
  await P.evaluate(() => { ONE.every = 10 * 60e3; ONE.at = 0; }); await T.evaluate(() => { ONE.at = 0; });
  await settle(P); R.pcNote = await P.evaluate(() => [ONE.note, syncCfg().file]); await settle(T); await settle(P);
  R.after = [await cards(T), await decks(T), await cards(P), await decks(P), await T.evaluate(() => syncCfg().file), await P.evaluate(() => syncCfg().file)];
  // the Sync screen shows the same code on both
  const code = async p => { await p.evaluate(() => syncSheet()); await p.waitForSelector("#syCopy"); const t = await p.$eval("#syCopy b", e => e.textContent); await p.evaluate(() => closeSheet()); return t; };
  R.codes = [await code(T), await code(P)];
  // after joining, a deletion on one device is a real deletion again (the record now belongs to the shared copy)
  await P.evaluate(() => { const k = Object.keys(S.coll).find(k => S.coll[k].name === "Sol Ring"); delete S.coll[k]; save(); SYNC.dirty = true; }); await settle(P, T);
  R.deleted = [await cards(T), await cards(P)];
  // looking again later changes nothing
  await P.evaluate(() => { ONE.at = 0; ONE.note = ""; }); await settle(P); R.again = await P.evaluate(() => [ONE.note, syncCfg().file]);
  // ---- GitHub: two "Deckhand sync" gists; a device using the newer one moves to the older one
  const GH = { gists: { g1: { id: "g1", description: "Deckhand sync (managed by the Deckhand app)", created_at: "2026-01-01T00:00:00Z", files: {} }, g2: { id: "g2", description: "Deckhand sync (managed by the Deckhand app)", created_at: "2026-03-01T00:00:00Z", files: {} } } };
  const X = await device(b, { viewport: { width: 1280, height: 900 } });
  await X.route("https://api.github.com/**", r => { const req = r.request(), u = new URL(req.url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "*" }, body: JSON.stringify(j) });
    if (u.pathname === "/user") return J({ login: "me" });
    if (u.pathname === "/gists" && req.method() === "GET") return J(Object.values(GH.gists).map(g => ({ id: g.id, description: g.description, created_at: g.created_at })));
    const id = u.pathname.split("/")[2], g = GH.gists[id]; if (!g) return J({}, 404);
    if (req.method() === "PATCH") { const f = JSON.parse(req.postData()).files; for (const [k, v] of Object.entries(f)) { if (v === null) delete g.files[k]; else g.files[k] = { filename: k, content: v.content }; } return J({ id, files: g.files }); }
    return J({ id, files: g.files, history: [] }); });
  await X.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; save(); });
  // g1 holds the tablet's cards (written by a device on g1)
  await X.evaluate(async () => { setSyncCfg({ token: "t", gist: "g1", login: "me" }); S.coll = {}; addToColl({ id: "sol", oid: "osol", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] }, "nonfoil", 2, "main"); save();
    await pushRemote(pickSync(S)); });
  // this device: on g2 with its own card and a matching record
  await X.evaluate(async () => { setSyncCfg({ token: "t", gist: "g2", login: "me" }); S.coll = {}; addToColl({ id: "bolt", oid: "obolt", name: "Lightning Bolt", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Instant", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] }, "nonfoil", 1, "main"); save();
    SYNC.etag = null; await pushRemote(pickSync(S)); await setSyncBase(pickSync(S)); const b = await syncBase(); delete b.target; await idbSet("syncBase", b); SYNC.base = b; ONE.at = 0; ONE.note = ""; SYNC.dirty = true; clearInterval(SYNC.poll); await syncNow(true); });
  R.gh = [await X.evaluate(() => syncCfg().gist), await cards(X), await X.evaluate(() => ONE.note)];
  R.ghRemote = await X.evaluate(async () => { SYNC.etag = null; const r = await readRemote(); return Object.values(r.state.coll).map(e => e.name + "×" + e.qty).sort().join(", "); });
  R.errs = [...T.errs, ...P.errs, ...X.errs];
  console.log(JSON.stringify(R, null, 1));
  ok(R.twoFiles === 2 && R.before[0] === "Sol Ring×2" && R.before[1] === "Lightning Bolt×1" && R.before[2], "set up the problem: two synced files, each device showing only its own cards");
  ok(/joined this device to the shared one/.test(R.pcNote[0]) && R.pcNote[1] === first, "the PC finds the other copy and joins the older one " + JSON.stringify(R.pcNote));
  ok(R.after[0] === "Lightning Bolt×1, Sol Ring×2" && R.after[2] === R.after[0] && R.after[1] === "PC deck, Tablet deck" && R.after[3] === R.after[1] && R.after[4] === first && R.after[5] === first, "both devices now have everything from both, on the same copy, nothing removed " + JSON.stringify(R.after));
  ok(R.codes[0] === R.codes[1] && R.codes[0].length >= 2, "the Sync screen shows the same copy code on both " + JSON.stringify(R.codes));
  ok(R.deleted[0] === "Lightning Bolt×1" && R.deleted[1] === "Lightning Bolt×1", "after that, removing a card on one device removes it on the other " + JSON.stringify(R.deleted));
  ok(R.again[0] === "" && R.again[1] === first, "looking again later changes nothing");
  ok(R.gh[0] === "g1" && R.gh[1] === "Lightning Bolt×1, Sol Ring×2" && /joined/.test(R.gh[2]) && R.ghRemote === "Lightning Bolt×1, Sol Ring×2", "GitHub: moves from the newer gist to the older one and combines both " + JSON.stringify([R.gh, R.ghRemote]));
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
