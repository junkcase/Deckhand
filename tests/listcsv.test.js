// Search → Orders: import an order or list from a CSV file. The columns are found by their headings and can be
// corrected; rows become list lines, looked up like pasted ones, and wait under Incoming until added.
// The files here are made up for the test (a store-style order, a totals-only sheet, a bare two-column list):
// they are not copies of any store's real export.
const { chromium, devices } = require("playwright"); const { spawn } = require("child_process");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const C = (id, name, set, num, o = {}) => Object.assign({ object: "card", id, oracle_id: "o-" + name, name, set, set_name: { clu: "Ravnica: Clue Edition", cmm: "Commander Masters", mh2: "Modern Horizons 2" }[set] || set, collector_number: num, rarity: "rare", type_line: "Instant", cmc: 1, mana_cost: "{R}", colors: ["R"], color_identity: ["R"],
  prices: { usd: "1.00", usd_foil: "3.00", usd_etched: "5.00" }, finishes: ["nonfoil", "foil"], legalities: { commander: "legal" }, image_uris: { small: "https://cards.scryfall.io/x.png", normal: "https://cards.scryfall.io/x.png" } }, o);
const SOL1 = "11111111-1111-4111-8111-111111111111", SOL2 = "22222222-2222-4222-8222-222222222222";
const ALL = [C("bolt-clu", "Lightning Bolt", "clu", "141"), C(SOL1, "Sol Ring", "cmm", "410"), C(SOL2, "Sol Ring", "cmm", "411"), C("fire-ice", "Fire // Ice", "mh2", "290"), C("kira", "Kira Nerys, Firebrand", "cmm", "77"),
  C("cs-etch", "Counterspell", "mh2", "400", { finishes: ["nonfoil", "foil", "etched"] }), C("path", "Path to Exile", "cmm", "40")];
const ORDER = `Order ID,Seller,Name,Set Code,Set Name,Collector Number,Finish,Condition,Language,Quantity,Price,Scryfall ID
MP-1001,Card Barn,Lightning Bolt,CLU,Ravnica: Clue Edition,141,Nonfoil,NM,EN,4,$0.76,
MP-1001,Card Barn,Sol Ring,CMM,Commander Masters,,Foil,NM,EN,1,2.50,${SOL2}
MP-1001,Card Barn,"Kira Nerys, Firebrand",CMM,Commander Masters,77,Nonfoil,LP,EN,2,0.40,
MP-1001,Other Shop,Fire // Ice,MH2,Modern Horizons 2,290,Nonfoil,NM,EN,1,1.10,
MP-1001,Other Shop,Counterspell,MH2,Modern Horizons 2,400,Etched Foil,NM,EN,1,6.00,
MP-1001,Other Shop,Path to Exile,CMM,Commander Masters,40,Nonfoil,NM,EN,1.5,3.00,
MP-1001,Other Shop,Zzzz Nothing Card,XXX,Nowhere,1,Nonfoil,NM,EN,1,9.99,
MP-1001,,,,,,,,,,2.99,
`;
const TOTALS = `sep=,\nQty,Card,Edition,Total\n4,Lightning Bolt,Ravnica: Clue Edition,3.04\n2,"Kira Nerys, Firebrand",Commander Masters,0.80\n`;
const BARE = `Name;Quantity\nLightning Bolt;3\nPath to Exile;1\n`;
const ODD = `Thing,How many,What I gave\nLightning Bolt,2,1.52\nPath to Exile,1,3.00\n`;
async function run(opts, label) {
  const b = await chromium.launch(), p = await (await b.newContext(opts)).newPage(), errs = [], M = { ids: [] };
  p.on("pageerror", e => errs.push(e.message));
  await p.route("https://cards.scryfall.io/**", r => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("https://api.scryfall.com/**", r => { const u = decodeURIComponent(r.request().url()), J = (j, st = 200) => r.fulfill({ status: st, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(j) });
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST" } });
    if (u.includes("/cards/collection")) { const ids = JSON.parse(r.request().postData()).identifiers, data = [], nf = []; M.ids.push(...ids);
      for (const i of ids) { const c = ALL.find(c => i.id ? c.id === i.id : i.collector_number ? c.set === i.set && c.collector_number === i.collector_number : (c.name === i.name || c.name.startsWith(i.name + " //")) && (!i.set || c.set === i.set)); c ? data.push(c) : nf.push(i); }
      return J({ data, not_found: nf }); }
    if (/\/sets(\?|$)/.test(u)) return J({ data: [{ code: "clu", name: "Ravnica: Clue Edition", set_type: "draft_innovation", released_at: "2024-02-23", card_count: 284 }, { code: "cmm", name: "Commander Masters", set_type: "masters", released_at: "2023-08-04", card_count: 1067 }, { code: "mh2", name: "Modern Horizons 2", set_type: "draft_innovation", released_at: "2021-06-18", card_count: 500 }], has_more: false });
    return J({ object: "error", status: 404 }, 404); });
  await p.route(u => /^https:/.test(u.href) && !/scryfall/.test(u.hostname), r => r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "{}" }));
  await p.goto("http://127.0.0.1:8904/app_real.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { sv.mode = "lists"; go("search"); }); await p.waitForSelector("#lsFile");
  const txt = sel => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
  const pick = async (name, text) => { const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("#lsFile")]); await fc.setFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") }); await p.waitForTimeout(500); };

  ok(await p.$eval('#sMode [data-m="lists"]', e => e.textContent.trim().replace(/\s*·.*$/, "")) === "Orders" && await p.$eval("#viewTitle", e => e.textContent) === "Orders", `${label}: the page is called Orders`);
  ok(/Or import a CSV file/.test(await txt("#lsFile")) && await p.$eval("#lsText", e => !e.hidden), `${label}: there is a button to import a CSV file, beside the box for pasting`);

  // ---- a store-style order file
  await pick("mana-pool_order-1001.csv", ORDER);
  ok(await p.$eval("#lsName", e => e.value) === "mana pool order 1001" && await p.$eval("#lsOrder", e => e.checked) && await p.$eval("#lsPaid", e => e.checked), `${label}: the file's name becomes the list's name, and a file with prices is ticked as an order with prices paid`);
  ok(/mana-pool_order-1001\.csv/.test(await txt("#lsCsvBox")) && await txt("#lsCsvCount") === "10 cards in 6 rows" && await p.$eval("#lsText", e => e.hidden), `${label}: it shows what was read: ${await txt("#lsCsvCount")}`);
  const prev = await p.$$eval("#lsCsvPrev tbody tr", a => a.map(tr => [...tr.children].map(td => td.textContent.trim()).join(" / ")));
  ok(prev[0] === "4 / Lightning Bolt / CLU / 141 / normal / $0.76" && prev[1] === "1 / Sol Ring / CMM /  / foil / $2.50" && prev[2] === "2 / Kira Nerys, Firebrand / CMM / 77 / normal / $0.40" && prev[4] === "1 / Counterspell / MH2 / 400 / etched / $6.00", `${label}: the preview has quantity, name (a comma inside quotes kept), set, number, finish and price (${prev[0]})`);
  ok(/1 row won't be imported.*row 7 Path to Exile: “1\.5”/.test(await txt("#lsCsvBad")), `${label}: a row whose quantity isn't a whole number is not imported, and is named (${(await txt("#lsCsvBad")).slice(0, 80)})`);
  ok(/1 row without a card \(totals, shipping or blank\) is left out/.test(await txt("#lsCsvOther")), `${label}: the shipping line is left out, and said to be`);
  const cols = await p.$$eval("#lsCsvCols [data-lcol]", a => Object.fromEntries(a.map(x => [x.dataset.lcol, x.options[x.selectedIndex].textContent])));
  ok(cols.name === "Name" && cols.qty === "Quantity" && cols.set === "Set Code" && cols.setName === "Set Name" && cols.num === "Collector Number" && cols.id === "Scryfall ID" && cols.foil === "Finish" && cols.price === "Price" && cols.total === "Not in file", `${label}: the columns were found by their headings (${JSON.stringify(cols)})`);
  ok(await p.evaluate(() => Object.keys(S.lists).length === 0 && Object.keys(S.coll).length === 0), `${label}: nothing is saved until the cards are looked up`);
  await p.click("#lsGo"); await p.waitForSelector("#lBack");
  const L = await p.evaluate(() => { const l = Object.values(S.lists)[0]; return { name: l.name, order: l.order, paid: l.paid, perLine: !!l.perLine, items: l.items.map(it => ({ name: it.name, qty: it.qty, st: it.st, fin: it.finish, card: it.card && `${it.card.id}|${it.card.set}|${it.card.num}`, price: it.price, each: listPaid(l, it), keys: Object.keys(it).sort().join() })), total: listSpent(l), left: listLeft(l) }; });
  ok(L.name === "mana pool order 1001" && L.order === true && L.paid === true && !L.perLine && L.items.length === 6, `${label}: the list is saved as an order with ${L.items.length} lines`);
  const it = n => L.items.find(x => x.name === n);
  ok(it("Sol Ring").card === `${SOL2}|cmm|411` && it("Sol Ring").fin === "foil" && M.ids.some(i => i.id === SOL2), `${label}: a row with a Scryfall ID gets that exact printing (${it("Sol Ring").card})`);
  ok(it("Lightning Bolt").card === "bolt-clu|clu|141" && it("Lightning Bolt").qty === 4 && it("Fire // Ice").card === "fire-ice|mh2|290" && it("Kira Nerys, Firebrand").qty === 2, `${label}: other rows are found by set and collector number, with their quantities`);
  ok(it("Counterspell").fin === "etched" && it("Lightning Bolt").fin === "nonfoil", `${label}: finishes are read (etched, foil, normal)`);
  ok(it("Lightning Bolt").each === 0.76 && it("Sol Ring").each === 2.5 && Math.abs(L.total - (4 * 0.76 + 2.5 + 2 * 0.4 + 1.1 + 6 + 9.99)) < 0.001, `${label}: the price on each row is kept as what one card cost; order total ${L.total.toFixed(2)}`);
  ok(it("Zzzz Nothing Card").st === "missing" && !it("Path to Exile"), `${label}: a card that can't be found is marked not found; the bad-quantity row is not in the list`);
  ok(L.items.every(x => !/sid/.test(x.keys)) && L.items.every(x => x.keys === L.items[0].keys || /guess|price|qty0/.test(x.keys)), `${label}: list lines have the same fields as pasted ones (the Scryfall ID isn't kept)`);
  ok(L.left === 9 && await p.evaluate(() => Object.keys(S.coll).length === 0 && onTheWay().length === 1), `${label}: the 9 found cards wait under Incoming; the collection is untouched until they are added`);
  ok(/Incoming · order/.test(await txt("#view")) && /order total \$23\.43/.test(await txt("#view")), `${label}: the open list shows it is an incoming order, with its total`);
  await p.click("#lBack"); await p.waitForSelector("#lsFile");
  ok(await p.$eval("#lsCsv", e => !e.innerHTML) && await p.$eval("#lsText", e => !e.hidden) && /mana pool order 1001/.test(await txt("#view")) && /Order/.test(await txt("#view")), `${label}: back on the page, the file is cleared and the order is listed under Incoming`);

  // ---- a sheet with only line totals and set names
  await pick("totals.csv", TOTALS);
  const prev2 = await p.$$eval("#lsCsvPrev tbody tr", a => a.map(tr => [...tr.children].map(td => td.textContent.trim()).join(" / ")));
  ok(prev2[0] === "4 / Lightning Bolt / CLU /  / normal / $3.04" && /Line price/.test(await txt("#lsCsvPrev thead")), `${label}: a "sep=" line is skipped; set names become set codes; a Total column is read as the price of the whole line (${prev2[0]})`);
  await p.click("#lsGo"); await p.waitForSelector("#lBack");
  const L2 = await p.evaluate(() => { const l = Object.values(S.lists).sort((a, b) => b.created - a.created)[0]; return { perLine: !!l.perLine, each: l.items.map(it => listPaid(l, it)), card: l.items[0].card && l.items[0].card.set, total: listSpent(l) }; });
  ok(L2.perLine && L2.each.join() === "0.76,0.4" && L2.card === "clu" && Math.abs(L2.total - 3.84) < 0.001, `${label}: line totals are divided by the quantity: ${L2.each.join(" and ")} each, ${L2.total.toFixed(2)} in all`);
  await p.click("#lBack"); await p.waitForSelector("#lsFile");

  // ---- a bare list with semicolons and no prices
  await pick("bare.csv", BARE);
  ok(await txt("#lsCsvCount") === "4 cards in 2 rows" && !(await p.$eval("#lsOrder", e => e.checked)), `${label}: a semicolon file with just names and quantities reads too, and isn't assumed to be an order`);
  await p.click("#lsCsvX"); await p.waitForTimeout(100);
  ok(await p.$eval("#lsCsv", e => !e.innerHTML) && await p.$eval("#lsText", e => !e.hidden), `${label}: Remove file puts the paste box back`);

  // ---- headings it can't recognise: say so, and let the columns be chosen
  await pick("odd.csv", ODD);
  ok(/No rows have a card name/.test(await txt("#lsCsvNone")) && await p.$eval("#lsCsvCols", e => e.open), `${label}: unrecognised headings: it says no cards could be read and opens the column choices`);
  await p.click("#lsGo"); await p.waitForTimeout(150);
  ok(/No card rows could be read from that file/.test(await txt("#lsMsg")) && await p.evaluate(() => Object.keys(S.lists).length === 2), `${label}: looking up with nothing readable saves nothing`);
  await p.selectOption('[data-lcol="name"]', { label: "Thing" }); await p.waitForTimeout(100); await p.selectOption('[data-lcol="qty"]', { label: "How many" }); await p.waitForTimeout(100); await p.selectOption('[data-lcol="total"]', { label: "What I gave" }); await p.waitForTimeout(100);
  ok(await txt("#lsCsvCount") === "3 cards in 2 rows" && /Line price/.test(await txt("#lsCsvPrev thead")) && await p.$eval("#lsCsvCols", e => e.open), `${label}: after choosing the columns by hand the cards are read (${await txt("#lsCsvCount")})`);
  await p.click("#lsCsvX");

  // ---- not a CSV at all; and pasting still works
  await pick("notes.csv", "just some words\nand more words\n");
  ok(/doesn't look like a CSV/.test(await txt("#lsMsg")) && await p.$eval("#lsCsv", e => !e.innerHTML), `${label}: a file that isn't a table is refused with a message`);
  await p.fill("#lsName", "Pasted"); await p.fill("#lsText", "2 Lightning Bolt\n1 Path to Exile $3.00"); await p.click("#lsGo"); await p.waitForSelector("#lBack");
  ok(await p.evaluate(() => { const l = Object.values(S.lists).find(x => x.name === "Pasted"); return l && l.items.length === 2 && l.items.every(it => it.card); }), `${label}: pasting a list still works as before`);
  // ---- adding from an imported order uses the usual flow and the price paid
  await p.click("#lBack"); await p.evaluate(() => { lv.open = Object.values(S.lists).find(l => l.name === "mana pool order 1001").id; lv.idx = -1; renderLists(); }); await p.waitForSelector("#lAdd");
  await p.click("#lAdd"); await p.waitForTimeout(300);
  const got = await p.evaluate(() => Object.values(S.coll).map(e => `${e.name}|${e.qty}|${e.set}|${e.finish}|${e.paid}`).join(";"));
  ok(got === "Lightning Bolt|4|clu|nonfoil|0.76", `${label}: adding the first card of the imported order puts it in the collection with the price paid (${got})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: fits the screen`);
  ok(!errs.length, `${label}: no errors` + (errs.length ? ": " + errs[0] : "")); await b.close();
}
(async () => {
  const srv = spawn("python3", ["-m", "http.server", "8904", "--bind", "127.0.0.1"], { cwd: __dirname, stdio: "ignore" }); await new Promise(r => setTimeout(r, 600));
  try { await run({ viewport: { width: 1280, height: 900 } }, "computer"); await run({ ...devices["Pixel 7"] }, "phone"); } finally { srv.kill(); }
  process.exit(process.exitCode || 0);
})().catch(e => { console.log("FAIL crashed:", e && e.stack); process.exit(1); });
