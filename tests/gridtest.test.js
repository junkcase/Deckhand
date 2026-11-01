const { chromium } = require("playwright"); const { spawn } = require("child_process"); const fs = require("fs");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const CARDS = [
 ["Lightning Bolt","2x2","117","#c33"],["Counterspell","mh2","267","#36c"],["Sol Ring","cmm","410","#999"],["Thought Scour","mh2","52","#36c"],
 ["Swords to Plowshares","sta","10","#ddc"],["Llanowar Elves","dom","168","#3a5"],["Dark Ritual","sta","26","#333"],["Birds of Paradise","m12","165","#3a5"],
 ["Arcane Signet","cmm","369","#999"],["Cultivate","m21","177","#3a5"],["Rhystic Study","pcy","45","#36c"],["Path to Exile","con","15","#ddc"],
 ["Command Tower","cmm","350","#a87"],["Demonic Tutor","uma","93","#333"],["Brainstorm","sta","13","#36c"],["Beast Within","pc2","63","#3a5"],
 ["Smothering Tithe","rna","22","#ddc"],["Chaos Warp","cmm","205","#c33"],["Thoughtseize","2xm","107","#333"],["Eternal Witness","uma","163","#3a5"]];
const ONLY = process.argv[2]; const CASES0 = [
  { name: "tablet photo, 4 cards (2x2)", W: 1824, H: 3264, R: 2, C: 2, cards: [0, 1, 2, 3] },
  { name: "tablet photo, 6 cards (3 rows of 2)", W: 1824, H: 3264, R: 3, C: 2, cards: [4, 5, 6, 7, 8, 9] },
  { name: "tablet photo, 9 cards (3x3), one spot empty", W: 1824, H: 3264, R: 3, C: 3, cards: [10, 11, 12, 13, -1, 15, 16, 17, 19] },
  { name: "Pixel photo, 9 cards (3x3)", W: 3000, H: 4000, R: 3, C: 3, cards: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  { name: "Pixel photo, 12 cards (4 rows of 3)", W: 3000, H: 4000, R: 4, C: 3, cards: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0] },
  { name: "sideways Pixel photo: 3 rows of 4, '4 rows of 3' picked", W: 4000, H: 3000, R: 3, C: 4, pick: "4x3", cards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: "your tablet's camera-app photo: 1440x1080, 12 cards", W: 1440, H: 1080, R: 3, C: 4, pick: "4x3", cards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], expectLow: true }];
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8768", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
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
  await p.goto("http://127.0.0.1:8768/app.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { window.CROPS = []; const P = prep; prep = function (...a) { const c = P.apply(this, a); CROPS.push(c.toDataURL("image/jpeg", 0.7)); return c; }; const D = drawBox; drawBox = function (g, v, b, W, H) { D(g, v, b, W, H); if (W > 300) (window.BOXES = window.BOXES || []).push(g.canvas.toDataURL("image/jpeg", 0.5)); }; });
  await p.evaluate(async () => { go("scan"); await loadNames(); await getWorkers(); });
  const CASES = ONLY ? CASES0.filter((c, i) => String(i) === ONLY) : CASES0;
  for (const cs of CASES) {
    const r = await p.evaluate(async ({ cs, CARDS, dump }) => {
      const cardImg = (card, seed) => {
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
  
        return C;
      };
      const F = document.createElement("canvas"); F.width = cs.W; F.height = cs.H; const f = F.getContext("2d");
      let s = 99; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const bg = f.createLinearGradient(0, 0, cs.W, cs.H); bg.addColorStop(0, "#6b5440"); bg.addColorStop(1, "#4a3a2c"); f.fillStyle = bg; f.fillRect(0, 0, cs.W, cs.H);
      for (let k = 0; k < 400; k++) { f.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() * 120},0,${0.05 + rnd() * 0.08})`; f.fillRect(rnd() * cs.W, rnd() * cs.H, 4 + rnd() * 300, 2 + rnd() * 8); }
      const cw = cs.W / cs.C, ch = cs.H / cs.R, hh = Math.min(ch * 0.86, cw * 0.86 * 88 / 63), ww = hh * 63 / 88;
      cs.cards.forEach((ci, n) => {
        if (ci < 0) return;
        const r = Math.floor(n / cs.C), c = n % cs.C, img = cardImg(CARDS[ci], 1000 + ci * 31);
        f.save(); f.translate((c + 0.5) * cw + (rnd() - 0.5) * cw * 0.08, (r + 0.5) * ch + (rnd() - 0.5) * ch * 0.06); f.rotate((rnd() - 0.5) * 8 * Math.PI / 180);
        f.drawImage(img, -ww / 2, -hh / 2, ww, hh); f.restore();
      });
      const blob = await new Promise(r => F.toBlob(r, "image/jpeg", 0.9)), file = new File([blob], "cards.jpg", { type: "image/jpeg" });
      sc.items = []; sc.mode = "ask"; const t0 = performance.now();
      await scanPhotos([file], cs.pick || cs.R + "x" + cs.C);
      const boxes = (window.BOXES || []).splice(0); CROPS.splice(0); return { boxes, ms: Math.round(performance.now() - t0), status: document.querySelector("#gStatus").textContent,
        items: sc.items.map(it => ({ st: it.state, name: it.card ? it.card.name : null, conf: it.conf, cands: it.cands, read: it.read, qty: it.qty })), dump: dump ? F.toDataURL("image/jpeg", 0.6) : null };
    }, { cs, CARDS, dump: cs.R === 3 && cs.C === 3 && cs.W < 2000 });
    if (ONLY) r.boxes.forEach((u, i) => fs.writeFileSync(`gbox_${i}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
    if (r.dump) fs.writeFileSync("grid_tablet9.jpg", Buffer.from(r.dump.split(",")[1], "base64"));
    const want = cs.cards.filter(i => i >= 0).map(i => CARDS[i][0]);
    const got = r.items.filter(i => i.st !== "failed" && i.st !== "pick").flatMap(i => Array(i.qty || 1).fill(i.name));
    const right = want.filter(n => got.includes(n)).length, wrong = got.filter(n => !want.includes(n)).length;
    const high = r.items.filter(i => i.conf === "high").reduce((a, i) => a + (i.qty || 1), 0);
    console.log("  ", r.status, `(${(r.ms / 1000).toFixed(1)} s)`);
    r.items.filter(i => i.st === "failed" || i.st === "pick" || !want.includes(i.name)).forEach(i => console.log("     ", JSON.stringify(i)));
    if (cs.expectLow) { ok(/only 1440×1080/.test(r.status) && /highest resolution/.test(r.status) && wrong === 0, `${cs.name}: warns the photo is too small (${right}/${want.length} still read, ${wrong} wrong)`); continue; }
    ok(right >= want.length - 1 && wrong === 0, `${cs.name}: ${right}/${want.length} right (${high} high), ${wrong} wrong, ${(r.ms / want.length / 1000).toFixed(2)} s per card`);
  }
  await b.close(); srv.kill();
})();
