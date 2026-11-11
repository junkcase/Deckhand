// Sync races, with three devices on Google Drive: two devices saving at nearly the same moment (one upload replaces the
// other's), and a look at the synced copy that comes back older than what a device already has. Before the fix, the
// device whose upload was replaced deleted its own new cards ("reverted to an older version").
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
  await p.goto("http://127.0.0.1:8841/app_real.html"); await p.waitForTimeout(500);
  p.errs = errs; return p;
}
const card = (id, name) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] });

(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8841", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), R = {};
  const cards = p => p.evaluate(() => Object.values(S.coll).map(e => e.name + "×" + e.qty).sort().join(", "));
  const sync = p => p.evaluate(async () => { for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); await syncNow(true); for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); return SYNC.err; });
  const quiet = p => p.evaluate(() => { clearInterval(SYNC.poll); SYNC.poll = null; clearTimeout(SYNC.t); ONE.every = 1e12; ONE.at = Date.now(); });
  const add = (p, id, name, q = 1) => p.evaluate(([c, q]) => { addToColl(c, "nonfoil", q, "main"); save(); }, [card(id, name), q]);
  const signIn = async p => { await p.evaluate(() => { S.binders = { main: { id: "main", name: "Collection" } }; save(); go("coll"); syncSheet(); }); await p.waitForSelector("#syGoogle"); await p.click("#syGoogle");
    await p.waitForFunction(() => syncOn() && !SYNC.busy && SYNC.at, null, { timeout: 8000 }); await quiet(p); await p.evaluate(() => closeSheet()); };
  const A = await device(b, devices["Pixel 7"]), B = await device(b, devices["iPad Mini"] || { viewport: { width: 768, height: 1024 } }), C = await device(b, { viewport: { width: 1280, height: 900 } });
  await A.evaluate(c => { S.binders = { main: { id: "main", name: "Collection" } }; addToColl(c, "nonfoil", 1, "main"); save(); }, card("sol", "Sol Ring"));
  await signIn(A); await signIn(B); await signIn(C);
  R.start = [await cards(A), await cards(B), await cards(C)];
  // the phone adds a card and saves; the tablet adds one too, but works from the copy it saw before the phone's save
  await add(A, "bolt", "Lightning Bolt"); R.aErr = await sync(A);
  await add(B, "kiora", "Kiora"); G.stale = 2; R.bErr = await sync(B); G.stale = 0;
  R.afterRace = await B.evaluate(async () => { GDS.version = null; const r = await gdReadSync(); return r && r.state ? Object.values(r.state.coll).map(e => e.name).sort().join(", ") : "?"; });
  // the phone looks next: its card is missing from the synced copy because the tablet's upload replaced it
  R.aSync = await sync(A); R.a = await cards(A); R.aReplaced = await A.evaluate(() => SYNC.replaced || 0);
  await sync(B); await sync(C);
  R.all = [await cards(A), await cards(B), await cards(C)];
  // a look that comes back older than what the phone already has: nothing changes, it looks again
  await add(A, "helix", "Lightning Helix"); await sync(A);
  G.stale = 2; R.staleErr = await sync(A); R.staleCards = await cards(A); R.staleSkip = await A.evaluate(() => SYNC.stale); G.stale = 0;
  await sync(A); await sync(B); await sync(C);
  R.all2 = [await cards(A), await cards(B), await cards(C)];
  // deleting still works after all that
  await A.evaluate(() => { const k = Object.keys(S.coll).find(k => S.coll[k].name === "Kiora"); delete S.coll[k]; save(); SYNC.dirty = true; });
  await sync(A); await sync(B); await sync(C);
  R.del = [await cards(A), await cards(B), await cards(C)];
  // the details each upload carries
  R.meta = await A.evaluate(() => [SYNC.rinfo.seq, SYNC.rinfo.chain.length, (SYNC.base || {}).pid === SYNC.rinfo.pid]);
  // the sync log the phone can copy
  R.log = await A.evaluate(() => syncLogText());
  // Google's sign-in is kept when the app is closed and opened again within the hour
  await C.reload(); await C.waitForTimeout(800); R.signedAfterReopen = await C.evaluate(() => gdSignedIn());
  // a fourth device that already has its own cards: combined on its own, nothing removed, no question
  const D = await device(b, { viewport: { width: 1000, height: 800 } });
  await D.evaluate(c => { S.binders = { main: { id: "main", name: "Collection" } }; addToColl(c, "nonfoil", 3, "main"); S.decks.d = { id: "d", name: "Laptop deck", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); }, card("path", "Path to Exile"));
  await signIn(D); R.d = [await cards(D), await D.evaluate(() => [!!SYNC.ask, Object.values(S.decks).map(x => x.name).join(), !!document.querySelector("#syComb")])];
  await sync(A); R.aAfterD = await cards(A);
  R.errs = [...A.errs, ...B.errs, ...C.errs, ...D.errs];
  console.log(JSON.stringify(R, null, 1));
  ok(R.start.every(x => x === "Sol Ring×1"), "three devices start the same " + JSON.stringify(R.start));
  ok(!R.aErr && !R.bErr && R.afterRace === "Kiora, Sol Ring", "set up the race: the tablet's upload replaced the phone's (the synced copy lost Lightning Bolt)");
  ok(!R.aSync && R.a === "Kiora×1, Lightning Bolt×1, Sol Ring×1" && R.aReplaced === 1, "the phone notices its upload was replaced and keeps its new card, adding the tablet's: " + R.a);
  ok(R.all.every(x => x === "Kiora×1, Lightning Bolt×1, Sol Ring×1"), "all three devices end up the same " + JSON.stringify(R.all));
  ok(!R.staleErr && R.staleSkip === 1 && R.staleCards === "Kiora×1, Lightning Bolt×1, Lightning Helix×1, Sol Ring×1", "an older look at the synced copy changes nothing (no reverting) " + R.staleCards);
  ok(R.all2.every(x => x === "Kiora×1, Lightning Bolt×1, Lightning Helix×1, Sol Ring×1"), "then everything arrives everywhere " + JSON.stringify(R.all2));
  ok(R.del.every(x => x === "Lightning Bolt×1, Lightning Helix×1, Sol Ring×1"), "a card removed on one device is removed on all " + JSON.stringify(R.del));
  ok(R.meta[0] >= 4 && R.meta[1] >= 3 && R.meta[2], "uploads carry a version number and the versions they were built on " + JSON.stringify(R.meta));
  ok(/Deckhand sync log/.test(R.log) && /another device's upload replaced this one's; combined again from the version both started from/.test(R.log) && /saw an older synced copy/.test(R.log) && /sent this device's changes/.test(R.log), "the sync log records what happened, to copy from the Sync screen");
  ok(R.signedAfterReopen, "Google's sign-in is kept when the app is reopened within the hour (no tap needed)");
  ok(R.d[0] === "Lightning Bolt×1, Lightning Helix×1, Path to Exile×3, Sol Ring×1" && !R.d[1][0] && !R.d[1][2] && /Laptop deck/.test(R.d[1][1]), "a device that already has cards combines with the synced copy on its own, nothing removed " + JSON.stringify(R.d));
  ok(R.aAfterD === R.d[0], "and the others get its cards " + R.aAfterD);
  ok(!R.errs.length, "no page errors " + R.errs.join(" | "));
  await b.close(); srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
