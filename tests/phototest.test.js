const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8767", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 800, height: 1280 } });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.addInitScript(() => { window.BENCH_CARDS = []; window.BENCH_CARD = i => i.name === "Lightning Bolt" || (i.set === "2x2" && i.collector_number === "117") ? { id: "b1", oracle_id: "o", name: "Lightning Bolt", set: "2x2", set_name: "2X2", collector_number: "117", rarity: "common", type_line: "Instant", cmc: 1, mana_cost: "", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: {}, image_uris: { small: "", normal: "" } } : null; });
  await p.goto("http://127.0.0.1:8767/app.html"); await p.waitForTimeout(400);
  for (const [scene, turn] of [["scene_base.jpg", 1], ["scene_base.jpg", -1], ["scene_tilt6.jpg", 0], ["scene_tilt12.jpg", 1], ["scene_far.jpg", 0], ["scene_offcenter.jpg", -1], ["scene_keystone.jpg", 0], ["scene_dim.jpg", 0]]) {
    const r = await p.evaluate(async ({ scene, turn }) => {
      go("scan"); await loadNames(); await getWorkers();
      const img = new Image(); img.src = scene; await img.decode();
      const V = document.createElement("canvas"); V.width = 1080; V.height = 1440; V.getContext("2d").drawImage(img, 0, 0);
      Object.defineProperty(V, "videoWidth", { value: 1080 }); Object.defineProperty(V, "videoHeight", { value: 1440 });
      // the "photo": 3x the size, delivered sideways (turn = ±1) like some cameras do
      const P = document.createElement("canvas"), W = 3240, H = 4320; if (turn) { P.width = H; P.height = W; } else { P.width = W; P.height = H; }
      const g = P.getContext("2d"); g.translate(P.width / 2, P.height / 2); g.rotate(turn * Math.PI / 2); g.drawImage(img, -W / 2, -H / 2, W, H);
      const blob = await new Promise(r => P.toBlob(r, "image/jpeg", 0.92));
      camDev.ic = { takePhoto: async () => blob }; S.meta.fullPhoto = true;
      const t0 = performance.now(); const shot = await grabShot(V); const tCap = performance.now() - t0;
      sc.items = []; sc.cur = { t0: performance.now(), wait: 0, try: 1, ms: {} }; sc.cur.src = shot.src; sc.cur.res = shot.res;
      const okR = await captureFrom("snap", shot.c, false); const e = S.scanLog.at(-1);
      // and when the photo fails, a normal snapshot is used
      camDev.ic = { takePhoto: async () => { throw new Error("no"); } }; const fb = await grabShot(V);
      return { src: shot.src, res: shot.res, w: shot.c.width, h: shot.c.height, tCap: Math.round(tCap), okR, result: e.result, conf: e.conf, logSrc: e.src, fb: fb && fb.src };
    }, { scene, turn });
    console.log("  ", scene, "turn", turn, JSON.stringify(r));
    ok(r.src === "photo" && r.result.startsWith("Lightning Bolt") && r.logSrc === "photo", `${scene}${turn ? " (photo sideways)" : ""}: card found in the photo, read as ${r.result} [${r.conf}], crop ${r.w}x${r.h} from ${r.res}`);
    ok(r.fb === "snapshot (photo failed)", "photo fails → falls back to a snapshot");
  }
  await b.close(); srv.kill();
})();
