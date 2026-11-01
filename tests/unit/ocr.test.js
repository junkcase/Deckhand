const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window;
w.scrollTo = () => {};
const real = ["Lightning Bolt", "Lightning Helix", "Lightning Greaves", "Counterspell", "Sol Ring", "Sheoldred, the Apocalypse", "Atraxa, Praetors' Voice", "Delver of Secrets // Insectile Aberration", "Llanowar Elves", "Elvish Mystic", "Thoughtseize", "Thought Scour", "Swords to Plowshares", "Path to Exile", "Ragavan, Nimble Pilferer", "Jötun Grunt", "Island", "Islandwalk", "Brainstorm", "Ponder", "Preordain", "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki", "Sakura-Tribe Elder", "Arcane Signet", "Command Tower", "Cultivate", "Kodama's Reach", "Rhystic Study", "Smothering Tithe", "The One Ring", "Orcish Bowmasters", "Ugin, the Spirit Dragon"];
// pad to ~32k names with realistic-looking fakes for the speed test
const syl = ["ar","bel","cor","dra","el","fen","gor","hal","is","jar","kel","lor","mor","nar","or","pal","quel","ros","sar","tor","ul","vor","wyn","xan","yor","zel"];
let seed = 7; const rnd = n => (seed = (seed * 16807) % 2147483647) % n;
const fake = () => { const word = () => { let t = ""; for (let i = 0, k = 2 + rnd(2); i < k; i++) t += syl[rnd(syl.length)]; return t[0].toUpperCase() + t.slice(1); }; return [word(), rnd(3) ? "of the" : "", word()].filter(Boolean).join(" "); };
const all = real.slice(); while (all.length < 32000) all.push(fake());
w.fetch = async (u) => { if (String(u).includes("card-names")) return { ok: true, status: 200, json: async () => ({ data: all }) }; return { ok: false, status: 404, json: async () => ({}) }; };
w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={setNames,nameMatches,cleanName,suggest};");
const T = w.T; T.setNames(all);
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const cases = [
  ["Lightnlng Bolt", "Lightning Bolt"], ["Ughtning Bolt", "Lightning Bolt"], ["LIGHTNING BOLT", "Lightning Bolt"],
  ["Counterspel", "Counterspell"], ["Sheoldred, the Apocalypse", "Sheoldred, the Apocalypse"], ["Sheo1dred the Apoca1ypse", "Sheoldred, the Apocalypse"],
  ["Atraxa, Praetors Voice", "Atraxa, Praetors' Voice"], ["Delver of Secrets", "Delver of Secrets // Insectile Aberration"],
  ["Jotun Grunt", "Jötun Grunt"], ["Swords to Plowshare5", "Swords to Plowshares"], ["Ragavan Nimble Pilferer", "Ragavan, Nimble Pilferer"],
  ["Fable of the Mirror Breaker", "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki"], ["Sakura Tribe Elder", "Sakura-Tribe Elder"],
  ["Kodamas Reach", "Kodama's Reach"], ["Rhvstic Studv", "Rhystic Study"], ["The 0ne Ring", "The One Ring"], ["Orcish Bowrnasters", "Orcish Bowmasters"],
];
let right = 0, ms = 0;
for (const [read, want] of cases) {
  const t0 = Date.now(); const m = T.nameMatches(T.cleanName(read)); ms = Math.max(ms, Date.now() - t0);
  const hit = m[0] && m[0].name === want; right += hit;
  if (!hit) console.log("   miss:", read, "->", JSON.stringify(m.slice(0, 2)));
}
ok(right === cases.length, `matched ${right}/${cases.length} misread names`);
ok(ms < 120, `slowest match over 32,000 names: ${ms} ms`);
const th = T.nameMatches("Thought Sc0ur"); ok(th[0] && th[0].name === "Thought Scour" && th.length >= 1, "close names ranked: " + th.slice(0, 3).map(x => x.name + " " + x.score.toFixed(2)).join(", "));
const t1 = Date.now(); for (let i = 0; i < 20; i++) T.nameMatches(cases[i % cases.length][0]); ok((Date.now() - t1) / 20 < 60, "average match time: " + ((Date.now() - t1) / 20).toFixed(1) + " ms");
ok((T.suggest("Thought", 5) || []).length >= 2, "partial read falls back to prefix suggestions: " + T.suggest("Thought", 5).join(", "));
