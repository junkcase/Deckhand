const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(require("path").join(__dirname, "../../index.html"), "utf8").replace(/<script src=[^>]+><\/script>/, "").replace(/<link[^>]+>/g, "");
const fakeCards = {
  "11111111-1111-1111-1111-111111111111": { name: "Sol Ring", set: "cmm", collector_number: "410" },
};
function card(o) { const id = o.id || (o.set + "-" + o.collector_number + "-" + o.name).replace(/\W/g, ""); return Object.assign({ id, oracle_id: "o-" + o.name, set_name: "Set " + o.set, rarity: "rare", type_line: "Artifact", cmc: 1, mana_cost: "{1}", colors: [], color_identity: [], prices: { usd: "1.00", usd_foil: "3.00" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal" }, image_uris: { small: "s.jpg", normal: "n.jpg" } }, o); }
const KNOWN = [card({ id: "11111111-1111-1111-1111-111111111111", name: "Sol Ring", set: "cmm", collector_number: "410" }),
  card({ name: "Lightning Bolt", set: "m10", collector_number: "146" }), card({ name: "Lightning Bolt", set: "2x2", collector_number: "117" }),
  card({ name: "Counterspell", set: "mh2", collector_number: "267" }), card({ name: "Atraxa, Praetors' Voice", set: "c16", collector_number: "28", type_line: "Legendary Creature" }),
  card({ name: "Island", set: "fdn", collector_number: "279", type_line: "Basic Land — Island" })];
function resolve(idt) {
  if (idt.id) return KNOWN.find(c => c.id === idt.id);
  if (idt.collector_number) return KNOWN.find(c => c.set === idt.set && c.collector_number === idt.collector_number);
  if (idt.set) return KNOWN.find(c => c.set === idt.set && c.name.toLowerCase() === idt.name.toLowerCase());
  return KNOWN.find(c => c.name.toLowerCase() === idt.name.toLowerCase());
}
async function run(csvText, fileName, target, pick) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://junkcase.github.io/Deckhand/" });
  const w = dom.window;
  w.scrollTo = () => {};
  w.fetch = async (url, opt) => {
    const u = String(url);
    const ok = j => ({ ok: true, status: 200, json: async () => j });
    if (u.endsWith("/cards/collection")) { const ids = JSON.parse(opt.body).identifiers; const data = [], nf = []; ids.forEach(i => { const c = resolve(i); c ? data.push(c) : nf.push(i); }); return ok({ data, not_found: nf }); }
    if (u.endsWith("/sets")) return ok({ data: [{ name: "Magic 2010", code: "m10" }, { name: "Commander 2016", code: "c16" }] });
    if (u.includes("/catalog/card-names")) return ok({ data: KNOWN.map(c => c.name) });
    return { ok: false, status: 404, json: async () => ({ details: "nf" }) };
  };
  const js = fs.readFileSync(require("path").join(__dirname, "../.build/app.js"), "utf8");
  w.eval(js + "\n;window.__t={S:()=>S,csvImport,go};");
  const file = { name: fileName, text: async () => csvText };
  await w.__t.csvImport(file, target);
  const $ = s => w.document.querySelector(s);
  if (pick) pick($, w);
  const preview = $("#impBody").textContent.replace(/\s+/g, " ");
  $("#impGo").click();
  for (let i = 0; i < 60 && !$("#impDone") && $("#impBody") && !/stopped/.test(($("#impProg") || {}).textContent || ""); i++) await new Promise(r => setTimeout(r, 150));
  return { S: w.__t.S(), preview, result: (($("#impRes") || {}).textContent || ($("#impProg") || {}).textContent || ($("#toastRoot") || {}).textContent || "").replace(/\s+/g, " ").trim() };
}
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  // ManaBox: comma, binder names, scryfall ids
  let r = await run(`Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price
Trade Stuff,binder,Sol Ring,CMM,Commander Masters,410,foil,uncommon,2,1,11111111-1111-1111-1111-111111111111,1.0
My Wants,list,Lightning Bolt,M10,Magic 2010,146,normal,common,4,2,,0.5
`, "ManaBox_Collection.csv", { kind: "coll" });
  ok(/ManaBox/.test(r.preview) && /6 cards in 2 rows/.test(r.preview), "ManaBox detected, preview counts: " + r.preview.slice(0, 120));
  const bn = Object.values(r.S.binders).map(b => b.name);
  ok(bn.includes("Trade Stuff") && bn.includes("My Wants"), "binders created from file");
  const sol = Object.values(r.S.coll).find(e => e.name === "Sol Ring");
  ok(sol && sol.qty === 2 && sol.finish === "foil", "foil Sol Ring x2 imported");
  ok(/Imported 6 cards/.test(r.result), "result: " + r.result.slice(0, 90));
  // Moxfield: Edition = set code, Count
  r = await run(`"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"
"3","0","Counterspell","mh2","Near Mint","English","","","","267","False","False",""
"1","0","Nonexistent Card","xyz","Near Mint","English","","","","1","False","False",""
`, "moxfield_haves.csv", { kind: "coll" }, ($, w) => { $("#impDest").value = "trade"; $("#impDest").dispatchEvent(new w.Event("change")); });
  ok(Object.values(r.S.coll).some(e => e.name === "Counterspell" && e.qty === 3 && e.binder === "trade"), "Moxfield set code + number into Trade binder");
  ok(/1 row couldn't be found/.test(r.result) && /Nonexistent Card/.test(r.result), "missing row reported");
  // Deckbox: Edition = full set name, semicolon delimited
  r = await run(`Count;Tradelist Count;Name;Edition;Card Number;Condition;Foil
2;0;Lightning Bolt;Magic 2010;146;Near Mint;
1;0;Atraxa, Praetors' Voice;Commander 2016;28;Near Mint;foil
`, "deckbox.csv", { kind: "coll" });
  ok(/Deckbox/.test(r.preview), "Deckbox detected");
  ok(Object.values(r.S.coll).some(e => e.name === "Lightning Bolt" && e.set === "m10" && e.qty === 2), "set NAME mapped to code (semicolon file)");
  ok(Object.values(r.S.coll).some(e => e.name.startsWith("Atraxa") && e.finish === "foil"), "foil from 'foil' text");
  // Deck CSV with board column, new deck, bad set falls back to name
  r = await run(`Quantity,Name,Set,Board
1,"Atraxa, Praetors' Voice",c16,commander
4,Lightning Bolt,zzz,mainboard
30,Island,fdn,main
2,Counterspell,,sideboard
1,Sol Ring,,maybeboard
`, "Atraxa Superfriends.csv", { kind: "deck", id: "__new" });
  const d = Object.values(r.S.decks)[0];
  ok(d && d.name === "Atraxa Superfriends" && d.format === "commander" && d.cmdr.length === 1, "new commander deck named from file");
  const dc = Object.values(d.cards);
  ok(dc.find(c => c.name === "Lightning Bolt" && c.qty === 4) && dc.find(c => c.name === "Counterspell" && c.side), "main + sideboard placed; bad set retried by name");
  ok(!dc.find(c => c.name === "Sol Ring") && /Skipped 1/.test(r.result) && /newest printing/.test(r.result), "maybeboard skipped, guess noted: " + r.result.slice(0, 160));
  // text files (.txt): Arena / Moxfield style with sections, and MTGO style (sideboard after a blank line)
  r = await run(`Commander
1 Atraxa, Praetors' Voice

Deck
4 Lightning Bolt (2X2) 117
2x Counterspell
1 Sol Ring *F*

Sideboard
3 Island
`, "atraxa.txt", { kind: "deck", id: "__new" });
  const dk = Object.values(r.S.decks)[0], cs_ = k => Object.values(dk ? dk.cards : {}).filter(c => k(c)).map(c => `${c.qty}${c.name.split(/[ ,]/)[0]}${c.set ? "/" + c.set : ""}`).sort().join(" ");
  ok(/a text list, one card per line/.test(r.preview), "a .txt deck file is read as a list: " + r.preview.slice(0, 110));
  ok(dk && dk.name === "atraxa" && cs_(c => !c.side) === "1Atraxa/c16 1Sol/cmm 2Counterspell/mh2 4Lightning/2x2" && cs_(c => c.side) === "3Island/fdn", "new deck named after the file; main, sideboard and the exact printing kept: " + (dk ? cs_(() => true) : "no deck"));
  ok(dk && dk.cmdr.length === 1 && dk.format === "commander", "the Commander section becomes the commander");
  r = await run(`4 Lightning Bolt
2 Counterspell

3 Island`, "mtgo-deck.txt", { kind: "deck", id: "__new" });
  const dk2 = Object.values(r.S.decks)[0];
  ok(dk2 && Object.values(dk2.cards).filter(c => c.side).map(c => c.name).join() === "Island" && Object.values(dk2.cards).filter(c => !c.side).length === 2, "MTGO style: the group after the blank line is the sideboard");
  // Commander lists without headings: the 1-card group is the commander, first (Moxfield) or last (MTGO); the 99 stay in the main deck
  const side_ = d => Object.values(d.cards).filter(c => c.side).reduce((a, c) => a + c.qty, 0), main_ = d => Object.values(d.cards).filter(c => !c.side).reduce((a, c) => a + c.qty, 0);
  const NINETYNINE = "4 Lightning Bolt\n2 Counterspell\n1 Sol Ring\n92 Island";
  for (const [label, text] of [["commander first", "1 Atraxa, Praetors' Voice\n\n" + NINETYNINE], ["commander last (MTGO)", NINETYNINE + "\n\n1 Atraxa, Praetors' Voice"]]) {
    r = await run(text, "edh.txt", { kind: "deck", id: "__new" }); const d = Object.values(r.S.decks)[0];
    ok(d && side_(d) === 0 && main_(d) === 100 && d.format === "commander" && d.cmdr.length === 1 && d.cards[d.cmdr[0]].name.startsWith("Atraxa"), `${label}: Commander list goes in the main deck with Atraxa as commander, nothing in the sideboard (${d ? side_(d) + " side, " + main_(d) + " main" : "no deck"})`);
  }
  r = await run("Commander\n1 Atraxa, Praetors' Voice\n\n" + NINETYNINE, "edh2.txt", { kind: "deck", id: "__new" });
  const d3 = Object.values(r.S.decks)[0];
  ok(d3 && side_(d3) === 0 && main_(d3) === 100 && d3.cmdr.length === 1, "a Commander heading with no Deck heading: the blank line ends the commander section, the rest is the main deck");
  r = await run("20 Island\n4 Lightning Bolt\n\n30 Island\n2 Counterspell", "two-halves.txt", { kind: "deck", id: "__new" });
  const d4 = Object.values(r.S.decks)[0];
  ok(d4 && side_(d4) === 0 && main_(d4) === 56, "two big groups that aren't deck + sideboard: everything stays in the main deck rather than guessing");
  r = await run(`4 Lightning Bolt\n1 Sol Ring`, "deck.csv", { kind: "deck", id: "__new" });
  ok(/a text list/.test(r.preview) && Object.values(Object.values(r.S.decks)[0].cards).length === 2, "a list saved with the wrong extension is still recognised from its lines");
})();
