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
  card({ name: "Island", set: "fdn", collector_number: "279", type_line: "Basic Land — Island" }),
  card({ id: "22222222-2222-2222-2222-222222222222", name: "Sol Ring", set: "cmm", collector_number: "410", lang: "ja", prices: { usd: "6.00" } })];
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
  w.eval(js + "\n;window.__t={S:()=>S,csvImport,go,openCard,closeSheet,renderColl,takeCopies};"); w.URL.createObjectURL = b => { w.__lastBlob = b; return "blob:x"; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {};
  const file = { name: fileName, text: async () => csvText };
  await w.__t.csvImport(file, target);
  const $ = s => w.document.querySelector(s);
  if (pick) pick($, w);
  const preview = $("#impBody").textContent.replace(/\s+/g, " ");
  $("#impGo").click();
  for (let i = 0; i < 60 && !$("#impDone") && !/stopped/.test($("#impProg").textContent); i++) await new Promise(r => setTimeout(r, 150));
  return { w, $, S: w.__t.S(), preview, result: ($("#impRes").textContent || $("#impProg").textContent).replace(/\s+/g, " ").trim() };
}
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
(async () => {
  const MB = `Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency
Main,binder,Sol Ring,CMM,Commander Masters,410,normal,uncommon,2,1,11111111-1111-1111-1111-111111111111,1.25,false,false,near_mint,en,USD
Main,binder,Sol Ring,CMM,Commander Masters,410,normal,uncommon,1,2,11111111-1111-1111-1111-111111111111,0.50,false,false,light_played,en,USD
Main,binder,Sol Ring,CMM,Commander Masters,410,normal,uncommon,1,3,22222222-2222-2222-2222-222222222222,4.00,false,false,near_mint,ja,USD
Main,binder,Counterspell,MH2,Modern Horizons 2,267,foil,uncommon,1,4,,,false,false,played,en,USD`;
  let r = await run(MB, "ManaBox_Collection.csv", { kind: "coll" });
  const E = () => Object.entries(r.w.__t.S().coll).map(([k, e]) => e);
  const sum = () => E().map(e => `${e.qty}× ${e.name} ${e.lang || "en"} ${e.cond || "NM"} paid ${e.paid ?? "-"}`).sort();
  ok(JSON.stringify(sum()) === JSON.stringify(["1× Counterspell en MP paid -", "1× Sol Ring en LP paid 0.5", "1× Sol Ring ja NM paid 4", "2× Sol Ring en NM paid 1.25"]), "ManaBox import keeps condition, language and purchase price: " + sum().join(" | "));
  const { w, $ } = r; w.__t.go("coll"); await new Promise(z => setTimeout(z, 50));
  const txt = $("#view").textContent.replace(/\s+/g, " ");
  ok(/LP/.test(txt) && /JA/.test(txt) && /MP/.test(txt), "collection list shows condition (LP, MP) and language (JA) chips");
  ok(/You paid \$7\.00 for 4 cards with a purchase price; they're worth \$9\.00 now \+\$2\.00 \(\+29%\)/.test(txt), "profit/loss: paid $7.00 for 4 cards, worth $9.00 now, +$2.00 (+29%)");
  // edit: mark 1 of the 2 NM Sol Rings as Heavily Played, set a price paid on Counterspell
  const k = Object.keys(w.__t.S().coll).find(k => { const e = w.__t.S().coll[k]; return e.name === "Sol Ring" && !e.cond && e.lang !== "ja"; });
  const e0 = w.__t.S().coll[k]; w.__t.openCard(e0, e0.finish, e0.binder); await new Promise(z => setTimeout(z, 50));
  $(`[data-edit="${k}"]`).click(); $("#eN").value = "1"; $("#eCond").value = "HP"; $("#eCondGo").click(); await new Promise(z => setTimeout(z, 30));
  ok(JSON.stringify(sum().filter(x => /Sol Ring en/.test(x))) === JSON.stringify(["1× Sol Ring en HP paid 1.25", "1× Sol Ring en LP paid 0.5", "1× Sol Ring en NM paid 1.25"]), "set condition on 1 of 2 copies: they split into NM and HP, keeping the price paid");
  w.__t.closeSheet();
  const kc = Object.keys(w.__t.S().coll).find(k => w.__t.S().coll[k].name === "Counterspell"), ec = w.__t.S().coll[kc];
  w.__t.openCard(ec, ec.finish, ec.binder); await new Promise(z => setTimeout(z, 50)); $(`[data-edit="${kc}"]`).click();
  $("#ePaid").value = "2.5"; $("#ePaidGo").click(); await new Promise(z => setTimeout(z, 30));
  ok(w.__t.S().coll[kc].paid === 2.5 && /Paid \$2\.50 each/.test($("#sheetBody").textContent), "set what you paid: shows 'Paid $2.50 each · now …'");
  w.__t.closeSheet();
  // ManaBox export, then import it into a fresh app
  w.__t.go("coll"); w.document.querySelector("#cMore").click(); $("#ioMb").click();
  const csv = await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(w.__lastBlob); });
  ok(/^Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency/.test(csv) && /poor,en,USD/.test(csv) && /light_played/.test(csv) && /,ja,USD/.test(csv), "Export in ManaBox's format: same columns, conditions, languages, purchase prices");
  const before = sum();
  r = await run(csv, "deckhand-for-manabox.csv", { kind: "coll" });
  ok(JSON.stringify(sum()) === JSON.stringify(before), "round trip: importing that export gives back exactly the same cards: " + sum().join(" | "));
})();
