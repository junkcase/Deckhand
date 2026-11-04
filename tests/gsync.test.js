// Google sync: two devices share one file in a pretend Google Drive; connect, both directions, hour runs out → Tap to sync.
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
    return J({ files: live.filter(f => (f.parents || []).includes(parent) && (!name || f.name === name)).sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(({ data, ...f }) => f) });
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
  await p.goto("http://127.0.0.1:8789/app_real.html"); await p.waitForTimeout(500);
  p.errs = errs; return p;
}
const card = (id, name) => ({ id, oid: "o" + id, name, set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] });
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8789", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch();
  const A = await device(b, { viewport: { width: 1280, height: 900 } }), B = await device(b, devices["Pixel 7"]);
  const cards = p => p.evaluate(() => Object.values(S.coll).map(e => e.name + "×" + e.qty).sort().join(", "));
  const decks = p => p.evaluate(() => Object.values(S.decks).map(d => d.name).sort().join(", "));
  const settle = async (...ps) => { for (const p of ps) await p.evaluate(async () => { for (let i = 0; i < 100 && SYNC.busy; i++) await new Promise(r => setTimeout(r, 30)); await syncNow(true); }); };
  await A.evaluate(c => { S.binders = { main: { id: "main", name: "Collection" } }; addToColl(c[0], "nonfoil", 3, "main"); S.decks.k = { id: "k", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("coll"); }, [card("sol", "Sol Ring")]);
  // A: Sync → Sign in with Google
  await A.click("#cSync"); await A.waitForSelector("#syGoogle"); const setupText = await A.$eval("#syBody", e => e.textContent.replace(/\s+/g, " "));
  await A.screenshot({ path: __dirname + "/gsync_setup.png" });
  await A.click("#syGoogle"); await A.waitForFunction(() => syncOn() && !SYNC.busy && SYNC.at, null, { timeout: 8000 });
  const aCfg = await A.evaluate(() => [syncCfg().kind, syncCfg().email, gdCfg() && gdCfg().on]);
  const syncFile = Object.values(G.files).find(f => f.name === "deckhand-sync.json.gz"), folder = syncFile && G.files[syncFile.parents[0]];
  ok(/Sign in with Google/.test(setupText) && /With GitHub instead/.test(setupText), "Sync offers Google first, GitHub still there");
  ok(aCfg[0] === "google" && aCfg[1] === "friend@gmail.com" && aCfg[2] === true, `signing in turns on Google sync (and daily Drive backups) ${JSON.stringify(aCfg)}`);
  ok(syncFile && folder && folder.name === "Deckhand sync" && syncFile.data[0] === 0x1f, "a compressed sync file in a “Deckhand sync” folder");
  // B: empty phone signs in with the same Google account → gets everything
  await B.evaluate(() => { go("coll"); }); await B.click("#eSync"); await B.waitForSelector("#syGoogle"); await B.click("#syGoogle");
  await B.waitForFunction(() => syncOn() && !SYNC.busy && Object.keys(S.coll).length, null, { timeout: 8000 }).catch(() => {});
  ok(await cards(B) === "Sol Ring×3" && await decks(B) === "Kiora", `the phone loads the collection and decks (${await cards(B)} · ${await decks(B)})`);
  ok(Object.values(G.files).filter(f => f.name === "deckhand-sync.json.gz").length === 1, "both devices use the same file");
  // both directions
  await B.evaluate(c => { addToColl(c, "nonfoil", 2, "main"); S.decks.g = { id: "g", name: "Ghalta", format: "commander", cmdr: [], cards: {}, created: 2, updated: 2 }; save(); }, card("bolt", "Lightning Bolt"));
  await settle(B); await settle(A);
  ok(await cards(A) === "Lightning Bolt×2, Sol Ring×3" && await decks(A) === "Ghalta, Kiora", `phone → computer (${await cards(A)} · ${await decks(A)})`);
  await A.evaluate(() => { const k = Object.keys(S.coll).find(k => S.coll[k].name === "Sol Ring"); S.coll[k].qty = 1; save(); }); await settle(A); await settle(B);
  ok(await cards(B) === "Lightning Bolt×2, Sol Ring×1", `computer → phone (${await cards(B)})`);
  // nothing changed: only a small check, no download
  const m0 = G.media; await settle(A); await settle(A);
  ok(G.media === m0, "when nothing changed, a check doesn't download the file again");
  // Google's hour runs out on the phone: changes wait, the corner says Tap to sync, a tap signs in and sends them
  await B.evaluate(() => { GD.tok = null; GD.exp = 0; sessionStorage.removeItem("deckhand.gdtok"); }); await B.evaluate(() => closeSheet());
  await B.evaluate(c => { addToColl(c, "nonfoil", 1, "main"); save(); }, card("cs", "Counterspell")); await settle(B);
  const pill = await B.$eval("#syncPill", e => [e.textContent, e.className]);
  await B.screenshot({ path: __dirname + "/gsync_tap.png" });
  ok(pill[0] === "Tap to sync" && /warn/.test(pill[1]), `the corner button asks for a tap ${JSON.stringify(pill)}`);
  ok(await B.evaluate(() => !!Object.values(S.coll).find(e => e.name === "Counterspell")), "the change is kept on the phone meanwhile");
  const gs = await B.evaluate(() => window.__gsi); await B.click("#syncPill"); await B.waitForTimeout(800); await settle(A);
  ok(await B.evaluate(() => window.__gsi) === gs + 1 && /Counterspell×1/.test(await cards(A)), `one tap signs in again and syncs (computer: ${await cards(A)})`);
  ok(await B.$eval("#syncPill", e => e.textContent) === "Synced ✓", "then it shows Synced ✓");
  // missing deck: found in the daily Drive backups
  await A.evaluate(async () => { await gdBackupNow(true); }); await B.evaluate(() => { delete S.decks.g; save(); }); await settle(B); await settle(A);
  const found = await A.evaluate(async () => (await findOldDecks()).map(x => x.deck.name));
  ok(found.includes("Ghalta"), `“Find a missing deck” looks in the Drive backups (${JSON.stringify(found)})`);
  ok(!A.errs.length && !B.errs.length, `no console errors ${JSON.stringify([A.errs, B.errs])}`);
  await b.close(); srv.kill(); process.exit();
})();
