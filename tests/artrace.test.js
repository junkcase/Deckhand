const { chromium } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, set, num, o = {}) => Object.assign({ object: "card", id: `${set}-${num}`, oracle_id: "o-" + name, name, set, set_name: set.toUpperCase(), collector_number: num, released_at: "2023-01-01", rarity: "uncommon", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1" }, finishes: ["nonfoil"], legalities: { commander: "legal" }, image_uris: { small: `https://cards.scryfall.io/small/${set}-${num}.jpg`, normal: `https://cards.scryfall.io/normal/${set}-${num}.jpg` }, oracle_text: "{T}: Add {C}{C}." }, o);
const ALL = [C("Sol Ring", "cmm", "410"), C("Sol Ring", "ltc", "284"), C("Forest", "dom", "266", { type_line: "Basic Land — Forest", oracle_text: "({T}: Add {G}.)" }), C("Lightning Bolt", "2x2", "117", { type_line: "Instant" }), C("Lightning Bolt", "clb", "187", { type_line: "Instant" }),
  C("Krenko, Mob Boss", "ddt", "52", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] }), C("Krenko, Mob Boss", "m13", "139", { type_line: "Legendary Creature — Goblin", color_identity: ["R"] })];
const newest = n => ALL.filter(c => c.name === n)[0];
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8777", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 700));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 900 } }); p.on("pageerror", e => console.log("pageerror", e.message));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (u.includes("card-names")) return J({ data: [...new Set(ALL.map(c => c.name))] }); if (u.endsWith("/sets")) return J({ data: [] });
    let m = u.match(/named\?exact=([^&]+)(?:&set=(\w+))?/); if (m) { const c = ALL.find(c => c.name === m[1] && (!m[2] || c.set === m[2])); return c ? J(c) : J({ details: "No card" }, 404); }
    m = u.match(/named\?fuzzy=([^&]+)/); if (m) { const c = ALL.find(c => c.name.toLowerCase().startsWith(m[1].toLowerCase())); return c ? J(c) : J({}, 404); }
    let mid = u.match(/\/cards\/(\w+-\w+)$/); if (mid) { const c = ALL.find(c => c.id === mid[1]); return new Promise(res => setTimeout(() => res(c ? J(c) : J({}, 404)), 1800)); }   // slow on purpose
    m = u.match(/\/cards\/(\w+)\/(\w+)$/); if (m) { const c = ALL.find(c => c.set === m[1] && c.collector_number === m[2]); return c ? J(c) : J({ details: "Not found" }, 404); }
    if (u.includes("unique=prints")) { const n = u.match(/!"([^"]+)"/)[1]; return J({ data: ALL.filter(c => c.name === n), has_more: false }); }
    if (u.includes("/cards/collection")) return J({ data: [], not_found: [] });
    return J({}, 404); });
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") }));
  await p.goto("http://127.0.0.1:8777/app_real.html"); await p.waitForTimeout(600);
  await p.evaluate(sol => { const e = slim(sol); delete e.leg; addToColl(e, "nonfoil", 1, "main"); go("coll"); }, ALL[0]);
  await p.waitForTimeout(300);
  const big = () => p.evaluate(() => { const i = document.querySelector("#bigImg"); return i ? i.getAttribute("src") : null; });
  await p.evaluate(() => { const e = Object.values(S.coll)[0]; openCard(e, e.finish, e.binder); });     // starts the slow details download
  await p.waitForTimeout(150);
  await p.click("#cPickPr"); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll("#cPickBox .prints button[data-i]")].find(t => /LTC/i.test(t.textContent)).click()); await p.waitForTimeout(200);
  ok(/ltc-284/.test(await big()), "picked LTC: the picture is the LTC Sol Ring");
  await p.waitForTimeout(2200);                                                                            // the slow download for the CMM card arrives now
  ok(/ltc-284/.test(await big()) && /Add 1 · LTC #284/.test(await p.evaluate(() => document.querySelector("#sheetBody").textContent)), "…and stays LTC after the slow download arrives (it used to flip back to CMM): " + await big());
  await b.close(); srv.kill();
})();
