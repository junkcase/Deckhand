const { JSDOM } = require("jsdom"); const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const C = (name, set, num) => ({ id: set + num, oracle_id: "o" + name, name, set, set_name: set, collector_number: num, rarity: "common", type_line: "Instant", cmc: 1, mana_cost: "", colors: [], color_identity: [], prices: { usd: "0.10" }, finishes: ["nonfoil", "foil"], legalities: {}, image_uris: { small: "s", normal: "n" } });
const DB = [C("Faerie Seer", "mh1", "51"), C("Warden of Evos Isle", "m20", "79"), C("Unwind", "dom", "72"), C("Whirlwind Denial", "thb", "81"), C("Ichthyomorphosis", "thb", "51"), C("Unsubstantiate", "m21", "82"),
  C("String of Disappearances", "mh1", "72"), C("Scour All Possibilities", "mh1", "67"), C("Omen of the Sea", "thb", "58"), C("Skittering Surveyor", "dom", "230"), C("One with the Stars", "thb", "59"),
  C("Faerie Mastermind", "m20", "58"), C("Faerie Miscreant", "m19", "50"), C("Peek", "c13", "1"), C("Emcee", "unf", "1"), C("Omen of the Dead", "thb", "110"), C("Scour the Laboratory", "emn", "1"), C("Wind Drake", "m20", "1"), C("Unsummon", "m20", "78"), C("Unwilling Recruit", "x", "1"), C("Stars", "x", "2"), C("Sea Gate Oracle", "x", "3"), C("Sea Sprite", "x", "4"), C("One With the Wind", "x", "5"), C("One with the Kami", "x", "6"), C("Spellstutter Sprite", "x", "7"), C("Moonblade Shinobi", "mh1", "61")];
const EXTRA = fs.readFileSync(require("path").join(__dirname, "../names.js"), "utf8").match(/`([^`]+)`/)[1].split("|");
// [raw name read, set, number, what the tablet actually showed]
const LOG = [["q TT Sher", "", "81", "not read"], ["facrie Seer", "", "", "Faerie Seer · medium"], ["WaHiER of Evos Sle", "m20", "79", "Warden of Evos Isle · high"],
  ["Fagiie mn   To   ul", "", "5", "not read"], ["", "m20", "79", "Warden of Evos Isle · medium"], ["unving        i", "dom", "72", "Unwind · high"], ["Whirlwind Denial", "thb", "81", "Whirlwind Denial · high"],
  ["f EBiilfbmorphosis op", "thb", "51", "choices"], ["f UB Tantiate Ep", "m21", "82", "choices"], ["String of isa pasEantes TE", "mh1", "72", "choices"],
  ["Edis All Possibilities     i", "mh1", "67", "Scour All Possibilities · high"], ["Omen BF the Sea  RE", "thb", "58", "Omen of the Sea · high"], ["EEE", "dom", "230", "choices"],
  ["Bo morphosis' To", "thb", "51", "choices"], ["f One ith the Stars ATE", "thb", "59", "One with the Stars · high"],
  ["Faerie Seer    i", "mh1", "61", "Faerie Seer · medium"], ["Skitfering Surveyor", "", "", "Skittering Surveyor · medium"], ["Scaull Possibilities wa", "mhi1", "67", "Scour All Possibilities · medium"],
  ["Uslistanciate             A", "", "", "choices"], ["One with the Sins", "", "5", "choices"], ["TTY Sprite", "", "", "choices"]];
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://x.github.io/" }); const w = dom.window; w.scrollTo = () => {};
  w.fetch = async (u, o) => { u = decodeURIComponent(String(u)); const J = (j, st = 200) => ({ ok: st === 200, status: st, json: async () => j });
    if (u.includes("card-names")) return J({ data: [...new Set([...EXTRA, ...DB.map(c => c.name)])] });
    if (u.endsWith("/sets")) return J({ data: ["mh1","m20","m21","dom","thb","mom"].map(code => ({ code, name: code })) });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(o.body).identifiers; return J({ data: ids.map(i => DB.find(c => i.collector_number ? c.set === i.set && c.collector_number === i.collector_number : c.name === i.name && (!i.set || c.set === i.set))).filter(Boolean) }); }
    return J({}, 404); };
  w.eval(fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8") + ";window.T={go,sc,identify,loadNames,S};");
  await new Promise(r => setTimeout(r, 150)); const T = w.T; T.go("scan"); await T.loadNames(); T.sc.mode = "ask";
  let high = 0, med = 0, low = 0, none = 0;
  for (const [raw, set, num, before] of LOG) {
    T.sc.cur = { t0: 0, ms: {} };
    const info = (num ? num.padStart(4, "0") + "/280 C\n" : "") + (set ? set.toUpperCase() + " • EN" : "");
    await T.identify(raw, info, 40); const c = T.sc.cur;
    ({ high: () => high++, medium: () => med++, low: () => low++ }[c.conf] || (() => none++))();
    console.log(`   ${JSON.stringify(raw).padEnd(30)} ${(set + " " + num).padEnd(9)} before: ${before.padEnd(32)} now: ${c.conf} ${c.result}${c.share != null ? "  (name share " + c.share + ")" : ""}`);
  }
  ok(high >= 13 && low <= 1, `${high} high, ${med} medium, ${low} choices, ${none} not read (tablet showed 7 high, 2 medium, 4 choices, 2 not read)`);
})();
