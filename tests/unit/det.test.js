const src = require("fs").readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8");
const a = src.indexOf("const DET = "), b = src.indexOf("function detectCard(vid)");
eval(src.slice(a, b).replace("const DET", "var DET"));
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = 113, H = 200;   // phone portrait frame downscaled
function scene({ cx = 0.5, cy = 0.5, ch = 0.55, tilt = 0, light = 1, clutter = 1, finger = false, card = true, other = null }) {
  const G = new Float32Array(W * H);
  // background: wood-ish stripes + blobs + noise
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) G[y * W + x] = 110 + 25 * Math.sin(x * 0.35 + y * 0.05) * clutter + (rnd() - 0.5) * 18 * clutter;
  const rects = other ? [other] : [];
  for (let k = 0; k < 6 * clutter; k++) rects.push({ x: rnd() * W, y: rnd() * H, w: 5 + rnd() * 25, h: 5 + rnd() * 25, v: 40 + rnd() * 150 });
  for (const r of rects) for (let y = Math.max(0, r.y | 0); y < Math.min(H, r.y + r.h); y++) for (let x = Math.max(0, r.x | 0); x < Math.min(W, r.x + r.w); x++) G[y * W + x] = r.v;
  const truth = card ? { h: ch * H, w: ch * H * 63 / 88 } : null;
  if (card) {
    truth.x = cx * W - truth.w / 2; truth.y = cy * H - truth.h / 2;
    const c = Math.cos(tilt * Math.PI / 180), s = Math.sin(tilt * Math.PI / 180), mx = cx * W, my = cy * H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - mx, dy = y - my, u = (dx * c + dy * s) / truth.w + 0.5, v = (-dx * s + dy * c) / truth.h + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      let val = 25;                                                     // black border
      if (u > 0.045 && u < 0.955 && v > 0.035 && v < 0.965) val = 170;  // frame color
      if (u > 0.08 && u < 0.92 && v > 0.11 && v < 0.55) val = 60 + ((x * 13 + y * 7) % 120);   // art
      if (u > 0.07 && u < 0.93 && v > 0.04 && v < 0.1) val = 215;       // name bar
      if (u > 0.08 && u < 0.92 && v > 0.6 && v < 0.92) val = 205;       // text box
      G[y * W + x] = val;
    }
    if (finger) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const fx = truth.x + truth.w, fy = truth.y + truth.h * 0.62; if ((x - fx) ** 2 / 120 + (y - fy) ** 2 / 500 < 1) G[y * W + x] = 150; }
  }
  for (let i = 0; i < G.length; i++) G[i] = G[i] * light + (rnd() - 0.5) * 6;
  return { G, truth };
}
globalThis.__dbg = () => { for (let k = 0; k < 10; k++) { const e = scene({ card: false, other: { x: 20, y: 60, w: 100, h: 60, v: 30 } }); const d = detectCore(e.G, W, H); if (d) console.log("   dbg", JSON.stringify({x:d.x,y:d.y,w:d.w,h:d.h,score:+d.score.toFixed(2)})); } };
const iouf = (a, b) => { const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h); const I = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return I / (a.w * a.h + b.w * b.h - I); };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
let hits = 0, n = 0, t0 = Date.now(), worst = 1;
const cases = [];
for (const ch of [0.3, 0.45, 0.6, 0.75]) for (const [cx, cy] of (ch > 0.6 ? [[0.5, 0.5], [0.5, 0.45], [0.5, 0.56]] : [[0.5, 0.5], [0.38, 0.42], [0.6, 0.58]])) for (const tilt of [0, 3, -4]) cases.push({ ch, cx, cy, tilt });
for (const c of cases) { const { G, truth } = scene(c); const r = detectCore(G, W, H); n++; const v = r ? iouf(r, truth) : 0; if (v > 0.8) hits++; worst = Math.min(worst, v); }
const per = (Date.now() - t0) / n;
ok(hits / n >= 0.9, `finds the card in ${hits}/${n} scenes (sizes 30–80% of view, off-center, tilted ±4°), worst overlap ${worst.toFixed(2)}`);
ok(per < 25, `detection time per frame: ${per.toFixed(1)} ms`);
let r = scene({ ch: 0.55, finger: true }); ok((() => { const d = detectCore(r.G, W, H); return d && iouf(d, r.truth) > 0.8; })(), "works with a finger over one edge");
r = scene({ ch: 0.55, light: 0.4 }); ok((() => { const d = detectCore(r.G, W, H); return d && iouf(d, r.truth) > 0.8; })(), "works in dim light");
r = scene({ ch: 0.55, clutter: 2 }); ok((() => { const d = detectCore(r.G, W, H); return d && iouf(d, r.truth) > 0.8; })(), "works on a busy background");
let fp = 0; for (let k = 0; k < 30; k++) { const e = scene({ card: false, clutter: 1 + (k % 3) * 0.5 }); if (detectCore(e.G, W, H)) fp++; }
ok(fp <= 1, `no card in view: false detections ${fp}/30`);
let fp2 = 0; for (let k = 0; k < 10; k++) { const e = scene({ card: false, other: { x: 20, y: 60, w: 100, h: 60, v: 30 } }); if (detectCore(e.G, W, H)) fp2++; }
ok(fp2 === 0, `a wide box (not card-shaped) isn't mistaken for a card: ${fp2}/10`);
seed = 3;
for (const c of cases) { const { G, truth } = scene(c); const r = detectCore(G, W, H); const v = r ? iouf(r, truth) : 0; if (v <= 0.8) console.log("   miss", JSON.stringify(c), "iou", v.toFixed(2), r ? `got ${r.w.toFixed(0)}x${r.h.toFixed(0)} at ${r.x},${r.y} want ${truth.w.toFixed(0)}x${truth.h.toFixed(0)} at ${truth.x.toFixed(0)},${truth.y.toFixed(0)}` : "none"); }
__dbg();
