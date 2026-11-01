// Deckhand scanner bench: synthetic card photos → the app's own detect/crop/OCR/match pipeline.
const { chromium } = require("playwright"); const { spawn } = require("child_process"); const fs = require("fs");
const OUT = process.argv[2] || "result.json", ONLY = process.argv[3];
const CARDS = [
 ["Lightning Bolt","2x2","117","#c33"],["Counterspell","mh2","267","#36c"],["Sol Ring","cmm","410","#999"],["Thought Scour","mh2","52","#36c"],
 ["Swords to Plowshares","sta","10","#ddc"],["Llanowar Elves","dom","168","#3a5"],["Dark Ritual","sta","26","#333"],["Birds of Paradise","m12","165","#3a5"],
 ["Arcane Signet","cmm","369","#999"],["Cultivate","m21","177","#3a5"],["Rhystic Study","pcy","45","#36c"],["Path to Exile","con","15","#ddc"],
 ["Command Tower","cmm","350","#a87"],["Demonic Tutor","uma","93","#333"],["Brainstorm","sta","13","#36c"],["Beast Within","pc2","63","#3a5"],
 ["Smothering Tithe","rna","22","#ddc"],["Chaos Warp","cmm","205","#c33"],["Thoughtseize","2xm","107","#333"],["Eternal Witness","uma","163","#3a5"]];
const CONDS = {
  base: { h: 0.72 }, far: { h: 0.46 }, veryfar: { h: 0.34 }, close: { h: 0.9 },
  offcenter: { h: 0.52, dx: 0.17, dy: -0.13 }, tilt6: { h: 0.66, rot: 6 }, tilt12: { h: 0.6, rot: -12 },
  dim: { h: 0.66, light: 0.45, noise: 14 }, glare: { h: 0.66, glare: 1, blur: 1 }, keystone: { h: 0.64, skew: 0.07, rot: 3 } };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8765", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 800, height: 1280 } });
  p.on("pageerror", e => console.log("pageerror", e.message));
  await p.addInitScript(cards => {
    window.BENCH_CARDS = cards;
    const mk = (name, set, num) => ({ id: name + "|" + set + "|" + num, oracle_id: "o" + name, name, set, set_name: set.toUpperCase(), collector_number: num, rarity: "common", type_line: "Instant", cmc: 1, mana_cost: "", colors: [], color_identity: [], prices: { usd: "1.00" }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: "", normal: "" } });
    window.BENCH_CARD = i => {
      if (i.collector_number) { const c = cards.find(c => c[1] === i.set && c[2] === i.collector_number); return c ? mk(c[0], c[1], c[2]) : null; }
      if (!BENCH_NAMES.includes(i.name)) return null;
      const c = cards.find(c => c[0] === i.name); if (i.set && (!c || c[1] !== i.set)) return null;
      return c ? mk(c[0], c[1], c[2]) : mk(i.name, "xxx", "1");
    };
  }, CARDS);
  await p.goto("http://127.0.0.1:8765/app.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { window.CROPS = []; const P = prep; prep = function (...a) { const c = P.apply(this, a); CROPS.push(c.toDataURL()); return c; }; });
  await p.evaluate(async () => { go("scan"); await loadNames(); await getWorkers(); });
  const res = [];
  for (const [cond, o] of Object.entries(CONDS)) {
    if (ONLY && !ONLY.split(",").includes(cond)) continue;
    for (let ci = 0; ci < (process.env.N ? +process.env.N : CARDS.length); ci++) {
      const r = await p.evaluate(async ({ card, o, seed }) => {
        const [name, set, num, color] = card;
        // --- draw the card (63:88) ---
        const cw = 630, ch = 880, C = document.createElement("canvas"); C.width = cw; C.height = ch; const g = C.getContext("2d");
        let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
        g.fillStyle = "#111"; rr(0, 0, cw, ch, 30);
        g.fillStyle = color; rr(26, 26, cw - 52, ch - 82, 14);
        g.fillStyle = "#e9e1cf"; rr(40, 40, cw - 80, 56, 12);                                    // title bar
        g.fillStyle = "#111"; g.font = `bold ${name.length > 17 ? 34 : 38}px "DejaVu Serif", serif`; g.textBaseline = "middle"; g.fillText(name, 56, 69);
        for (let k = 0; k < 2; k++) { g.fillStyle = ["#eee", "#c9c"][k]; g.beginPath(); g.arc(cw - 70 - k * 36, 69, 15, 0, 7); g.fill(); }
        g.fillStyle = "#222"; g.fillRect(52, 106, cw - 104, 380);                                 // art
        g.save(); g.beginPath(); g.rect(52, 106, cw - 104, 380); g.clip();
        for (let k = 0; k < 40; k++) { g.fillStyle = `hsl(${rnd() * 360},${30 + rnd() * 50}%,${20 + rnd() * 50}%)`; g.beginPath(); g.ellipse(52 + rnd() * (cw - 104), 106 + rnd() * 380, 15 + rnd() * 90, 15 + rnd() * 70, rnd() * 3, 0, 7); g.fill(); }
        g.restore();
        g.fillStyle = "#e9e1cf"; rr(40, 494, cw - 80, 46, 10); g.fillStyle = "#111"; g.font = `bold 26px "DejaVu Serif", serif`; g.fillText("Instant", 56, 517);
        g.fillStyle = "#efe9dc"; g.fillRect(56, 552, cw - 112, 226); g.fillStyle = "#222"; g.font = `22px "DejaVu Serif", serif`;
        ["Choose one or more. Draw a card,", "then discard a card. This is test", "text for a scanner benchmark."].forEach((t, k) => g.fillText(t, 74, 590 + k * 34));
        g.fillStyle = "#eee"; g.font = `bold 17px "DejaVu Sans Mono", monospace`;
        g.fillText(`${num.padStart(4, "0")}/0350 C`, 40, ch - 40); g.fillText(`${set.toUpperCase()} • EN  Test Artist`, 40, ch - 20);
        // --- the scene: a 1080x1440 camera frame ---
        const W = 1080, H = 1440, F = document.createElement("canvas"); F.width = W; F.height = H; const f = F.getContext("2d");
        const bg = f.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#6b5440"); bg.addColorStop(1, "#4a3a2c"); f.fillStyle = bg; f.fillRect(0, 0, W, H);
        for (let k = 0; k < 300; k++) { f.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() * 120},0,${0.05 + rnd() * 0.08})`; f.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 160, 2 + rnd() * 6); }
        f.fillStyle = "#d9a98a"; f.beginPath(); f.ellipse(W * 0.5 + (o.dx || 0) * W, H * 0.5 + (o.dy || 0) * H + o.h * H * 0.5, 170, 110, 0, 0, 7); f.fill();   // a thumb/hand
        const hh = o.h * H, ww = hh * 63 / 88;
        f.save(); if (o.blur) f.filter = `blur(${o.blur}px)`;
        f.translate(W / 2 + (o.dx || 0) * W, H / 2 + (o.dy || 0) * H); f.rotate((o.rot || 0) * Math.PI / 180); if (o.skew) f.transform(1, 0, o.skew, 1, 0, 0);
        f.drawImage(C, -ww / 2, -hh / 2, ww, hh); f.restore();
        if (o.glare) { const gx = W / 2 + ww * 0.1, gy = H / 2 - hh * 0.05, gr = f.createRadialGradient(gx, gy, 0, gx, gy, ww * 0.4); gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); f.fillStyle = gr; f.fillRect(0, 0, W, H); }
        if (o.light || o.noise) { const d = f.getImageData(0, 0, W, H), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = o.noise ? (rnd() - 0.5) * 2 * o.noise : 0; for (let c = 0; c < 3; c++) a[i + c] = a[i + c] * (o.light || 1) + n; } f.putImageData(d, 0, 0); }
        Object.defineProperty(F, "videoWidth", { value: W }); Object.defineProperty(F, "videoHeight", { value: H });
        // --- the app's pipeline, as autoTick → shootAndRead would run it ---
        det.box = null; det.cand = null; sc.items = []; sc.mode = "ask";
        const t0 = performance.now();
        det.tryA = null; det.ti = 0; for (let k = 0; k < 12; k++) { updateBox(F, detectCard(F)); await new Promise(r => setTimeout(r, 30)); }
        const tDet = (performance.now() - t0) / 12, locked = cardLocked(), box = locked ? Object.assign({}, det.box) : null;
        const tries = [];
        for (let k = 0; k < 2; k++) {
          const shot = await grabBest(F); if (o.dump && k === 0) window.SHOT = shot.c.toDataURL('image/jpeg', 0.8); sc.cur = { t0: performance.now(), wait: 0, try: k + 1, ms: {} };
          const ok = await captureFrom("snap", shot.c, k === 1); const e = S.scanLog.at(-1);
          tries.push({ ok, conf: e.conf, result: e.result, read: e.read, raw: e.raw, ocr: e.ocr, score: e.score, ms: e.ms.total, setnum: e.set + " " + e.num, cands: (sc.items.at(-1) || {}).cands });
          if (ok) break;
        }
        const crops = CROPS.splice(0); return { crops, locked, box, tDet: Math.round(tDet), tries, shot: o.dump ? window.SHOT : undefined, scene: o.dump ? F.toDataURL("image/jpeg", 0.8) : undefined };
      }, { card: CARDS[ci], o: Object.assign({ dump: ci === 0 }, o), seed: 1000 + ci * 31 });
      if (ci < 3) r.crops.forEach((u, k) => fs.writeFileSync(`crop_${cond}_${ci}_${k}.png`, Buffer.from(u.split(",")[1], "base64"))); console.log(JSON.stringify(r.box));
      if (r.shot) fs.writeFileSync(`shot_${cond}.jpg`, Buffer.from(r.shot.split(',')[1], 'base64'));
      if (r.scene) { fs.writeFileSync(`scene_${cond}.jpg`, Buffer.from(r.scene.split(",")[1], "base64")); delete r.scene; }
      const want = CARDS[ci][0], t = r.tries.at(-1), first = r.tries[0];
      const hit = x => x && x.ok && x.result && x.result.startsWith(want + " ");
      const cls = x => !x || !x.ok ? "fail" : x.conf === "low" ? ((x.cands || []).includes(want) ? "pick-ok" : "pick-wrong") : hit(x) ? "right-" + x.conf : "WRONG-" + x.conf;
      res.push({ cond, card: want, locked: r.locked, tDet: r.tDet, first: cls(first), final: cls(t), tries: r.tries.length, ms: r.tries.map(x => x.ms), read: r.tries.map(x => x.read || x.raw) });
      process.stdout.write(`${cond.padEnd(9)} ${want.padEnd(21)} lock:${r.locked ? "y" : "n"} ${cls(first).padEnd(12)} → ${cls(t).padEnd(12)} ${r.tries.map(x => x.ms + "ms").join(",")}  read: ${r.tries.map(x => JSON.stringify(x.read || x.raw)).join(" / ")}\n`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await b.close(); srv.kill();
})();
