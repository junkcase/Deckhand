// auto-capture with a card held in a hand: found, but never perfectly still
const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function setup(lockIt) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={go,sc,ana,det,AUTO,autoTick,setStream:v=>stream=v,setSample:f=>sampleCard=f,setShoot:f=>autoShoot=f};");
  await new Promise(r => setTimeout(r, 100));
  const T = w.T; T.go("scan"); T.sc.auto = true; T.setStream({ getTracks: () => [] });
  const vid = w.document.querySelector("#vid"); Object.defineProperty(vid, "videoWidth", { value: 1080 }); Object.defineProperty(vid, "videoHeight", { value: 1440 });
  const cam = w.document.querySelector("#cam"); Object.defineProperty(cam, "clientWidth", { value: 400 }); Object.defineProperty(cam, "clientHeight", { value: 540 });
  let now = 0; Object.defineProperty(w.performance, "now", { value: () => now, configurable: true });
  let shots = []; T.setShoot(() => shots.push(now));
  let k = 0; T.setSample(() => { const L = new Float32Array(144 * 200); for (let i = 0; i < L.length; i++) L[i] = 120 + 60 * Math.sin((i % 144 + (lockIt ? (k % 2) * 3 : 0)) / 3) ; k++; return { L, std: 40, text: 50, sharp: 2 }; });   // shifts 3px every frame
  let still = false; const tick = ms => { for (let t = 0; t < ms; t += 120) { now += 120; if (lockIt) { T.det.box = { x: 200, y: 200, w: 680, h: 950, a: 0 }; T.det.seen = now; T.det.moved = 0.03; } T.autoTick(); } };
  return { T, w, tick, shots: () => shots };
}
(async () => {
  let { T, w, tick, shots } = await setup(true);
  tick(360); ok(shots().length === 0 && /Hold still/.test(w.document.querySelector("#camHint").textContent), "card found but shaking: asks to hold still at first");
  tick(1000); ok(shots().length >= 1 && shots()[0] <= 1000, `…then takes the snapshot anyway ${shots()[0]} ms after the card appeared (target: 1 s; was 7–8 s on the tablet)`);
  ({ T, w, tick, shots } = await setup(false));
  tick(800); ok(shots().length === 0 && /edges/.test(w.document.querySelector("#camHint").textContent), "edges not found: waits for them instead of shooting a guess");
  tick(1500); ok(shots().length >= 1 && shots()[0] > 1000 && shots()[0] <= 1600, `…then falls back to the on-screen frame (shot at ${shots()[0]} ms)`);
})();
