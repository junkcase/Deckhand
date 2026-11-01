const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={det,updateBox,cardLocked,go};");
setTimeout(() => {
  const T = w.T; T.go("scan"); const cam = w.document.querySelector("#cam"); Object.defineProperty(cam, "clientWidth", { value: 400 }); Object.defineProperty(cam, "clientHeight", { value: 540 });
  const vid = { videoWidth: 1080, videoHeight: 1920 }, ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
  T.updateBox(vid, { x: 100, y: 100, w: 300, h: 420 }); T.updateBox(vid, null); ok(!T.cardLocked(), "single stray detection doesn't lock");
  T.updateBox(vid, { x: 300, y: 600, w: 500, h: 700 }); T.updateBox(vid, { x: 305, y: 598, w: 498, h: 703 }); ok(T.cardLocked(), "agreeing frames lock onto the card");
}, 100);
