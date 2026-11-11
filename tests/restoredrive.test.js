// Restoring a backup with Google Drive sync on: through the Drive restore screen and from a file, it combines with
// the device — cards added here and not synced yet, and cards removed on another device since, are all kept, here
// and in the synced copy. Each asks to confirm first and says what will happen.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const G = { files: {}, n: 0, gets: 0, media: 0, stale: 0 };          // one Drive shared by both devices
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
    if (id) { const f = G.files[id]; f.prev = { data: f.data, version: f.version, size: f.size, appProperties: f.appProperties }; Object.assign(f, meta, { data, version: String(+f.version + 1), size: String(data.length) }); return J({ id, version: f.version }); }
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
  // G.stale: answer the next look (details + contents) with the version before the latest, as a slow copy would
  const old = G.stale > 0 && f.prev ? f.prev : null;
  if (u.searchParams.get("alt") === "media") { G.media++; if (old) G.stale--; return r.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: old ? old.data : f.data }); }
  G.gets++; const { data, prev, ...meta } = f; return J(old ? Object.assign({}, meta, { version: old.version, size: old.size, appProperties: old.appProperties }) : meta);
}
async function device(b, opts) {
  const ctx = await b.newContext(opts), p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  await p.route("https://accounts.google.com/gsi/client", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `window.google={accounts:{oauth2:{initTokenClient(c){return{requestAccessToken(){window.__gsi=(window.__gsi||0)+1;setTimeout(()=>c.callback({access_token:"tok"+Date.now(),expires_in:3600}),30);}}}}}};` }));
  await p.route("https://www.googleapis.com/**", drive);
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8843/app_real.html"); await p.waitForTimeout(500);
  p.errs = errs; return p;
}
const card = (id, name) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] });


(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8843", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), R = {};
  const cards = p => p.evaluate(() => Object.values(S.coll).map(e => e.name + "×" + e.qty).sort().join(", "));
  const sync = p => p.evaluate(async () => { for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); await syncNow(true); for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); return SYNC.err; });
  const quiet = p => p.evaluate(() => { clearInterval(SYNC.poll); SYNC.poll = null; clearTimeout(SYNC.t); ONE.every = 1e12; ONE.at = Date.now(); });
  const remote = p => p.evaluate(async () => { GDS.version = null; const r = await gdReadSync(); return Object.values(r.state.coll).map(e => e.name + "×" + e.qty).sort().join(", "); });
  const signIn = async p => { await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; save(); go("coll"); syncSheet(); }); await p.waitForSelector("#syGoogle"); await p.click("#syGoogle");
    await p.waitForFunction(() => syncOn() && !SYNC.busy && SYNC.at, null, { timeout: 8000 }); await quiet(p); await p.evaluate(() => closeSheet()); };
  const A = await device(b, devices["Pixel 7"]), B = await device(b, { viewport: { width: 1280, height: 900 } });
  await A.evaluate(([s, l]) => { S.binders = { main: { id: "main", name: "Collection" } }; addToColl(s, "nonfoil", 3, "main"); addToColl(l, "nonfoil", 2, "main"); save(); }, [card("sol", "Sol Ring"), card("bolt", "Lightning Bolt")]);
  await signIn(A); await signIn(B);
  // a backup on Drive (the phone's), from before the changes below
  await A.evaluate(() => gdBackupNow(true)); await A.waitForTimeout(300);
  const bkId = Object.values(G.files).find(f => /^Deckhand backup /.test(f.name || "")).id;
  // since then: Path added here and not synced; the computer removed Sol Ring and synced
  await A.evaluate(c => { addToColl(c, "nonfoil", 4, "main"); save(); clearTimeout(SYNC.t); }, card("path", "Path to Exile"));
  await B.evaluate(() => { const k = Object.keys(S.coll).find(k => S.coll[k].name === "Sol Ring"); delete S.coll[k]; save(); SYNC.dirty = true; }); await sync(B);
  R.before = [await cards(A), await remote(B)];
  // the Drive restore screen, Sync on: says what happens, asks to confirm
  await A.evaluate(id => gdRestoreSheet([{ id, createdTime: new Date().toISOString(), appProperties: { device: "phone", cards: "5", decks: "0" } }]), bkId);
  R.words = await A.$eval("#gdRsWords", e => e.textContent);
  const btn = await A.$("#gdRsList [data-gdr]"); await btn.click(); R.confirm = await btn.textContent(); R.notYet = await cards(A);
  await btn.click(); await A.waitForFunction(() => !document.querySelector("#gdRsList"), null, { timeout: 8000 }); await A.waitForTimeout(300);
  R.toast = await A.evaluate(() => (document.querySelector("#toastRoot") || {}).textContent || "");
  R.after = [await cards(A), (await sync(A)) || "", await remote(A)]; await sync(B); R.computer = await cards(B);
  // restoring from a file, Sync on: asks first, then combines
  const file = await A.evaluate(async () => { const st = JSON.parse(JSON.stringify(S)); st.coll = Object.fromEntries(Object.entries(st.coll).filter(([k, e]) => e.name === "Lightning Bolt").map(([k, e]) => [k, Object.assign(e, { qty: 7 })])); return JSON.stringify(st); });
  await A.evaluate(() => ioSheet()); await A.waitForSelector("#ioRest");
  const [chooser] = await Promise.all([A.waitForEvent("filechooser"), A.click("#ioRest")]);
  await chooser.setFiles({ name: "deckhand-backup.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await A.waitForSelector("#ioRestAsk"); R.fileAsk = [await A.$eval("#ioRestAsk", e => e.textContent.replace(/\s+/g, " ")), await cards(A)];
  await A.click("#ioRestGo"); await A.waitForTimeout(500);
  R.fileAfter = [await cards(A), (await sync(A)) || "", await remote(A)];
  // a damaged file, Sync on: refused before anything changes
  await A.evaluate(() => ioSheet()); await A.waitForSelector("#ioRest");
  const [ch2] = await Promise.all([A.waitForEvent("filechooser"), A.click("#ioRest")]);
  await ch2.setFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ coll: null, decks: {} })) });
  await A.waitForTimeout(400); R.broken = [await A.$eval("#ioMsg", e => e.textContent), !(await A.$("#ioRestAsk")), await cards(A)];
  R.errs = [...A.errs, ...B.errs];
  console.log(JSON.stringify(R, null, 1));
  const all = "Lightning Bolt×2, Path to Exile×4, Sol Ring×3";
  ok(R.before[0] === all && R.before[1] === "Lightning Bolt×2", "set up: Path added here (not synced), Sol Ring removed on the computer");
  ok(/combines the backup with what's here/.test(R.words) && /nothing here is removed/.test(R.words) && R.confirm === "Tap again to combine" && R.notYet === all, "Drive restore screen with Sync on: says it combines, asks to confirm, nothing happens before the second tap");
  ok(R.after[0] === all && !R.after[1] && R.after[2] === all && R.computer === all && /combined with this device/.test(R.toast), "after: Path kept, Sol Ring back, on this device, in the synced copy and on the computer " + JSON.stringify(R.after));
  ok(/combines the backup/.test(R.fileAsk[0]) && /Combine with this device/.test(R.fileAsk[0]) && R.fileAsk[1] === all, "file restore with Sync on: asks first, nothing changes until confirmed");
  ok(R.fileAfter[0] === "Lightning Bolt×7, Path to Exile×4, Sol Ring×3" && !R.fileAfter[1] && R.fileAfter[2] === R.fileAfter[0], "file restore: the backup's 7 Lightning Bolts come in, nothing removed, synced " + JSON.stringify(R.fileAfter));
  ok(/isn't a Deckhand backup/.test(R.broken[0]) && R.broken[1] && R.broken[2] === "Lightning Bolt×7, Path to Exile×4, Sol Ring×3", "a damaged file is refused before asking, nothing changes " + JSON.stringify(R.broken));
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
