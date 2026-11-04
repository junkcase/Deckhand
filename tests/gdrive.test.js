// Google Drive backup against a pretend Google: connect, back up (gzip), keep 30, daily reminder, restore, hour limit.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process"); const zlib = require("zlib");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function run(opts, shot) {
  const srv = spawn("python3", ["-m", "http.server", "8783", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|fetching the script/.test(m.text())) errs.push(m.text()); });
  const G = { files: {}, n: 0, signIns: 0, uploads: [], auth: [] };
  // pretend Google sign-in library
  await p.route("https://accounts.google.com/gsi/client", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `window.google={accounts:{oauth2:{initTokenClient(c){return{requestAccessToken(){window.__gsi=(window.__gsi||0)+1;window.__gsiCfg=c;setTimeout(()=>c.callback({access_token:"tok"+window.__gsi,expires_in:3600}),30);}}}}}};` }));
  await p.route("https://www.googleapis.com/**", async r => {
    const req = r.request(), u = new URL(req.url()), m = req.method(), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    G.auth.push(req.headers().authorization);
    if (!/^Bearer tok\d+$/.test(req.headers().authorization || "")) return J({ error: { message: "no auth" } }, 401);
    if (u.pathname === "/drive/v3/about") return J({ user: { emailAddress: "junkcase0@gmail.com" } });
    if (u.pathname.startsWith("/upload/drive/v3/files")) {
      const body = req.postDataBuffer(), ct = req.headers()["content-type"], bd = ct.split("boundary=")[1];
      const parts = body.toString("latin1").split("--" + bd).filter(x => x.includes("Content-Disposition"));
      const meta = JSON.parse(parts[0].split("\r\n\r\n")[1].trim()); const raw = Buffer.from(parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""), "latin1");
      const upId = u.pathname.split("/")[5];
      if (upId && G.files[upId]) { Object.assign(G.files[upId], meta, { data: raw, modifiedTime: new Date(Date.now() + (++G.n)).toISOString() }); G.uploads.push("update " + G.files[upId].name); return J({ id: upId }); }
      const id = "f" + (++G.n), t = new Date(Date.now() + G.n).toISOString(); G.files[id] = Object.assign({ id, createdTime: t, modifiedTime: t, data: raw }, meta); G.uploads.push(meta.name); return J({ id });
    }
    if (u.pathname === "/drive/v3/files" && m === "GET") {
      const q = u.searchParams.get("q");
      if (/mimeType='application\/vnd.google-apps.folder'/.test(q)) return J({ files: Object.values(G.files).filter(f => f.mimeType === "application/vnd.google-apps.folder" && !f.trashed).map(f => ({ id: f.id })) });
      const parent = (q.match(/'([^']+)' in parents/) || [])[1], nm = (q.match(/name='([^']+)'/) || [])[1];
      return J({ files: Object.values(G.files).filter(f => (f.parents || []).includes(parent) && !f.trashed && (!nm || f.name === nm)).sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(({ data, ...f }) => f) });
    }
    if (u.pathname === "/drive/v3/files" && m === "POST") { const meta = JSON.parse(req.postData()); const id = "f" + (++G.n); G.files[id] = Object.assign({ id, createdTime: new Date().toISOString() }, meta); return J({ id }); }
    const id = u.pathname.split("/")[4]; const f = G.files[id]; if (!f) return J({}, 404);
    if (m === "PATCH") { Object.assign(f, JSON.parse(req.postData())); return J({ id }); }
    if (u.searchParams.get("alt") === "media") return r.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: f.data });
    return J({ id: f.id, trashed: !!f.trashed });
  });
  await p.route("https://api.scryfall.com/**", r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8783/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { S.binders.main = { id: "main", name: "Collection" }; const c = { id: "sol", oid: "o", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "uncommon", type: "Artifact", cmc: 1, colors: [], ci: [], img: "", prices: { usd: "1" }, finishes: ["nonfoil"] };
    addToColl(c, "nonfoil", 3, "main"); S.decks.k = { id: "k", name: "Kiora", format: "commander", cmdr: [], cards: {}, created: 1, updated: 1 }; save(); go("coll"); });
  const R = {};
  R.noNudge = !(await p.$("#gdNudge"));
  await p.click("#cMore"); await p.waitForTimeout(300);
  R.offText = await p.$eval("#gdBox", e => e.textContent.includes("Connect Google Drive"));
  await p.click("#gdOn"); await p.waitForFunction(() => /Last backup/.test((document.querySelector("#gdBox") || {}).textContent || ""), null, { timeout: 8000 }).catch(() => {});
  R.onText = await p.$eval("#gdBox", e => e.textContent.replace(/\s+/g, " "));
  const first = Object.values(G.files).find(f => /^Deckhand backup /.test(f.name || ""));
  R.first = first && { name: first.name, gz: first.data[0] === 0x1f && first.data[1] === 0x8b, folder: G.files[first.parents[0]] && G.files[first.parents[0]].name, props: first.appProperties,
    decoded: (() => { try { const d = JSON.parse(zlib.gunzipSync(first.data).toString()); return [Object.values(d.coll)[0].qty, Object.keys(d.decks).length]; } catch (e) { return String(e); } })() };
  R.signIns = await p.evaluate(() => window.__gsi);
  if (shot) await p.screenshot({ path: __dirname + "/" + shot });
  // 31 more backups: only the newest 30 kept, older ones to Drive's trash
  // more backups the same day replace today's file; 35 older days already there (old and new names): only the newest 30 are kept
  const folderId = first.parents[0];
  for (let i = 1; i <= 35; i++) { const d = new Date(Date.now() - i * 864e5).toISOString(); G.files["old" + i] = { id: "old" + i, name: i % 2 ? `Deckhand backup ${d.slice(0, 10)}.json.gz` : `deckhand-backup-${d.slice(0, 10)}T1200-tablet.json.gz`, parents: [folderId], createdTime: d, modifiedTime: d, data: first.data, appProperties: { device: "tablet", cards: "1", decks: "0" } }; }
  for (let i = 0; i < 3; i++) await p.evaluate(() => gdBackupNow(true));
  R.todays = Object.values(G.files).filter(f => f.name === first.name && !f.trashed).length; R.updates = G.uploads.filter(x => /^update /.test(x)).length;
  R.kept = Object.values(G.files).filter(f => /^(Deckhand backup |deckhand-backup-)/.test(f.name || "") && !f.trashed).length; R.trashed = Object.values(G.files).filter(f => f.trashed).length;
  R.oldestKept = Object.values(G.files).filter(f => /^(Deckhand backup |deckhand-backup-)/.test(f.name || "") && !f.trashed).map(f => f.id).filter(x => x.startsWith("old")).map(x => +x.slice(3)).sort((a, b) => b - a)[0];
  R.signInsAfter = await p.evaluate(() => window.__gsi);
  // restore (no sync): two taps, replaces
  await p.evaluate(() => { S.coll = {}; delete S.decks.k; save(); });
  await p.click("#gdRs"); await p.waitForSelector("#gdRsList [data-gdr]", { timeout: 5000 });
  R.rsText = await p.$eval("#gdRsList", e => e.textContent.replace(/\s+/g, " "));
  const btn = await p.$("#gdRsList [data-gdr]"); await btn.click(); R.confirm = await btn.textContent(); await btn.click(); await p.waitForTimeout(500);
  R.restored = await p.evaluate(() => [Object.values(S.coll).reduce((a, e) => a + e.qty, 0), !!S.decks.k]);
  // Google's hour runs out: daily reminder on Collection, one tap signs in again and backs up
  await p.evaluate(() => { GD.tok = null; sessionStorage.removeItem("deckhand.gdtok"); setGdCfg(Object.assign(gdCfg(), { last: Date.now() - 26 * 36e5 })); closeSheet(); go("coll"); });
  R.nudge = await p.$eval("#gdNudge", e => e.textContent.replace(/\s+/g, " ")).catch(() => null);
  const before = G.uploads.length; await p.click("#gdNow"); await p.waitForTimeout(800);
  R.nudgeDone = [!(await p.$("#gdNudge")), G.uploads.length > before, await p.evaluate(() => window.__gsi) > R.signInsAfter];
  await p.evaluate(() => { setGdCfg(Object.assign(gdCfg(), { last: Date.now() - 26 * 36e5 })); render(); }); await p.click("#gdLater"); await p.waitForTimeout(100); R.snoozed = !(await p.$("#gdNudge"));
  // hostile file details from Drive are shown as text
  R.xss = await p.evaluate(() => { window.__x = 0; gdRestoreSheet([{ id: "\"><img src=x onerror=__x=1>", createdTime: new Date().toISOString(), appProperties: { device: "<img src=x onerror=__x=1>", cards: "5", decks: "<b>" } }]); return 1; });
  await p.waitForTimeout(200); R.xssFired = await p.evaluate(() => window.__x); await p.evaluate(() => closeSheet());
  // stop
  await p.click("#cMore"); await p.waitForTimeout(200); await p.click("#gdOff"); await p.waitForTimeout(100);
  R.off = await p.evaluate(() => [gdCfg(), !!document.querySelector("#gdOn")]);
  R.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  R.errs = errs; await b.close(); srv.kill(); return R;
}
(async () => {
  for (const [label, opts, shot] of [["desktop", { viewport: { width: 1280, height: 900 } }, null], ["phone", devices["Pixel 7"], "gdrive_phone.png"]]) {
    const R = await run(opts, shot);
    ok(R.noNudge && R.offText, `${label}: nothing shown until Drive is connected; Backup / export offers Connect Google Drive`);
    ok(/junkcase0@gmail.com/.test(R.onText) && /Last backup: .*from your/.test(R.onText), `${label}: connecting signs in, makes the first backup and shows it (${R.onText.slice(0, 120)})`);
    ok(R.first && R.first.gz && R.first.folder === "Deckhand backups" && /^Deckhand backup \d{4}-\d\d-\d\d\.json\.gz$/.test(R.first.name) && R.first.props.cards === "3", `${label}: backup is a compressed file in a “Deckhand backups” folder ${JSON.stringify(R.first && { name: R.first.name, folder: R.first.folder, props: R.first.props })}`);
    ok(JSON.stringify(R.first && R.first.decoded) === "[3,1]", `${label}: the file holds the cards and decks ${JSON.stringify(R.first && R.first.decoded)}`);
    ok(R.todays === 1 && R.updates === 3, `${label}: one file per day: later backups the same day replace it (${R.updates} updates)`);
    ok(R.kept === 30 && R.trashed === 6 && R.oldestKept === 29, `${label}: keeps the newest 30 days, older ones go to Drive's trash (kept ${R.kept}, trashed ${R.trashed}, oldest kept ${R.oldestKept} days ago)`);
    ok(R.signInsAfter === R.signIns, `${label}: no extra Google sign-ins while the hour is running`);
    ok(/^Latest .*from your (computer|phone) · 3 cards, 1 decks/.test(R.rsText.trim()) && R.confirm === "Tap again to replace" && JSON.stringify(R.restored) === "[3,true]", `${label}: restore lists backups, asks to confirm, brings the cards and deck back ${JSON.stringify(R.restored)}`);
    ok(R.nudge && /Daily Google Drive backup/.test(R.nudge), `${label}: when a day has passed, Collection shows a one-tap backup reminder`);
    ok(R.nudgeDone.every(Boolean), `${label}: Back up now signs in again (Google's hour had run out) and backs up ${JSON.stringify(R.nudgeDone)}`);
    ok(R.snoozed, `${label}: Not today hides the reminder`);
    ok(!R.xssFired, `${label}: file details from Drive are shown as text`);
    ok(R.off[0] === null && R.off[1], `${label}: Stop Drive backups disconnects`);
    ok(!R.overflow, `${label}: no sideways scrolling`);
    ok(!R.errs.length, `${label}: no console errors ${JSON.stringify(R.errs)}`);
  }
})();
