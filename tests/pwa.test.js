const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8780", "--bind", "127.0.0.1"], { cwd: require("path").join(__dirname, ".."), stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 412, height: 900 } }), p = await ctx.newPage();
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|api\.scryfall/, r => r.abort());
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  // saved copies belonging to other sites on the same address, and an old Deckhand one, before Deckhand's helper starts
  await p.goto("http://127.0.0.1:8780/manifest.webmanifest"); await p.evaluate(async () => { for (const n of ["other-project-v1", "workbox-precache-v2", "deckhand-v1"]) await (await caches.open(n)).put("/x-" + n, new Response("x")); });
  await p.goto("http://127.0.0.1:8780/"); await p.waitForTimeout(1500);
  const keys = await p.evaluate(async () => { await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 500)); return (await caches.keys()).sort(); });
  ok(keys.includes("other-project-v1") && keys.includes("workbox-precache-v2") && !keys.includes("deckhand-v1") && keys.some(k => /^deckhand-v\d+$/.test(k)), "the offline helper clears only Deckhand's own old saved copies, not other sites' " + JSON.stringify(keys));
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); return l ? await (await fetch(l.href)).json() : null; });
  ok(man && man.display === "standalone" && man.icons.length === 3 && man.icons.some(i => i.purpose === "maskable") && man.start_url === "./", "manifest: installs full screen, with app icons (incl. Android's shaped icon)");
  for (const i of man.icons) { const st = await p.evaluate(async src => (await fetch(src)).status, i.src); if (st !== 200) ok(false, "icon missing " + i.src); }
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok(sw, "offline helper installed and active");
  ok(/Welcome to Deckhand/.test(await p.textContent("#view")) && await p.$("#eInst"), "first visit: welcome screen with what Deckhand does and an Install button");
  await p.reload(); await p.waitForTimeout(800);                                     // let the helper take control
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(1200);
  ok(/Deckhand|Welcome/.test(await p.textContent("body")) && await p.$("#view .empty"), "with the internet off, the app still opens");
  await ctx.setOffline(false);
  await p.evaluate(() => { S.coll.x = { id: "x", name: "Sol Ring", set: "cmm", setName: "CMM", num: "1", rarity: "rare", type: "Artifact", finishes: ["nonfoil", "foil"], prices: { usd: "1" }, img: "", imgN: "", oid: "o", qty: 1, finish: "nonfoil", binder: "main" }; go("scan"); });
  await p.waitForTimeout(400);
  await p.click("#camFoil"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => sc.finish === "foil" && document.querySelector("#camFoil").getAttribute("aria-pressed") === "true" && document.querySelector('#scFin [data-f="foil"]').getAttribute("aria-pressed") === "true"), "camera Foil button switches scanning to foil (and the Normal/Foil switch below follows)");
  await p.click("#camFoil"); await p.waitForTimeout(100);
  ok(await p.evaluate(() => sc.finish === "nonfoil"), "tap again for normal");
  await p.screenshot({ path: "cam_foil.png" });
  ok(!errs.filter(e => !/Tesseract|camera|getUserMedia/i.test(e)).length, "no page errors " + JSON.stringify(errs));
  await b.close(); srv.kill();
})();
