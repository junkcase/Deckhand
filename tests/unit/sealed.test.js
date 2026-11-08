// tools/sealed-mirror.js: Mana Pool's and Card Kingdom's sealed lists matched by name (set from Scryfall's set names for
// Card Kingdom-only products), prices in cents, and a daily history that stores a point only when the price changes.
const { combine, addHistory, norm, mainPrice } = require("../../tools/sealed-mirror.js");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const mp = { meta: { as_of: "2026-11-08T03:30:45Z" }, data: [
  { product_type: "mtg_sealed", set_code: "BLB", name: "Bloomburrow Play Booster Box", tcgplayer_product_id: 541154, language_id: "EN", low_price: 20621, available_quantity: 9, price_market: 20241, url: "https://manapool.com/sealed/blb/play-booster-box" },
  { product_type: "mtg_sealed", set_code: "BLB", name: "Bloomburrow Tin Mouse", tcgplayer_product_id: 1, language_id: "EN", low_price: 9999, available_quantity: 1, price_market: null, url: "u" },
  { product_type: "mtg_sealed", set_code: "BLB", name: "Bloomburrow Booster (Japanese)", tcgplayer_product_id: 2, language_id: "JA", low_price: 500, available_quantity: 1, price_market: null, url: "u" },
  { product_type: "mtg_sealed", set_code: "DSK", name: "Duskmourn Commander Deck - Endless Punishment", tcgplayer_product_id: 3, language_id: "EN", low_price: 4500, available_quantity: 2, price_market: 4700, url: "u" },
] };
const ck = { meta: { created_at: "2026-11-07 19:10:11" }, data: [
  { id: 1, url: "mtg-sealed/bloomburrow-play-booster-box", name: "Bloomburrow Play Booster Box", edition: "Bloomburrow", price_retail: "249.99", qty_retail: 2, price_buy: "150.00", qty_buying: 3 },
  { id: 2, url: "mtg-sealed/x", name: "Duskmourn Commander Deck: Endless Punishment", edition: "Duskmourn: House of Horror Commander", price_retail: "54.99", qty_retail: 1, price_buy: "0.00", qty_buying: 0 },
  { id: 3, url: "mtg-sealed/y", name: "Foundations Starter Collection", edition: "Foundations", price_retail: "69.99", qty_retail: 5, price_buy: "40.00", qty_buying: 2 },
  { id: 5, url: "mtg-sealed/w", name: "Modern Horizons 3 Collector's Edition Commander Deck - Eldrazi Incursion", edition: "MH3 Commander", price_retail: "199.99", qty_retail: 1, price_buy: "0", qty_buying: 0 },
  { id: 4, url: "mtg-sealed/z", name: "Nothing Priced", edition: "Foundations", price_retail: "0.00", qty_retail: 0, price_buy: "0.00", qty_buying: 0 },
] };
const sets = { data: [{ code: "blb", name: "Bloomburrow" }, { code: "fdn", name: "Foundations" }, { code: "dsc", name: "Duskmourn: House of Horror Commander" }, { code: "mh3", name: "Modern Horizons 3" }, { code: "m3c", name: "Modern Horizons 3 Commander" }, { code: "pmh3", name: "Modern Horizons 3 Promos", digital: true }] };
const P = combine(mp, ck, sets), by = Object.fromEntries(P.map(p => [p.name, p]));
ok(P.length === 5, `5 products: English only, unpriced left out (${P.map(p => p.name).join(" | ")})`);
const box = by["Bloomburrow Play Booster Box"];
ok(box && box.set === "blb" && JSON.stringify(box.mp) === '[20621,20241,9,"https://manapool.com/sealed/blb/play-booster-box"]' && JSON.stringify(box.ck) === '[24999,15000,3,"https://www.cardkingdom.com/mtg-sealed/bloomburrow-play-booster-box"]' && box.tcg === 541154, "the same box at both stores is one product with both prices, in cents " + JSON.stringify(box));
const deck = by["Duskmourn Commander Deck - Endless Punishment"];
ok(deck && deck.ck && deck.ck[0] === 5499 && deck.ck[1] === null, `“Deck - Name” and “Deck: Name” are the same product; a $0.00 buy price means not buying ${JSON.stringify(deck)}`);
const fdn = by["Foundations Starter Collection"];
ok(fdn && fdn.set === "fdn" && !fdn.mp, `a Card Kingdom-only product gets its set code from the set's name (${fdn && fdn.set})`);
ok(mainPrice(box) === 20241 && mainPrice(by["Bloomburrow Tin Mouse"]) === 9999 && mainPrice(fdn) === 6999, "main price: Mana Pool market, else Mana Pool lowest, else Card Kingdom retail");
ok(norm("Magic: The Gathering — Foundations Jumpstart Booster (Box)") === "magic the gathering foundations jumpstart booster box", `names are compared in one spelling (${norm("Magic: The Gathering — Foundations Jumpstart Booster (Box)")})`);
const mhc = by["Modern Horizons 3 Collector's Edition Commander Deck - Eldrazi Incursion"];
ok(mhc && mhc.set === "mh3", `an edition name Scryfall doesn't use: the longest set name the product starts with (${mhc && mhc.set})`);
// history
const h = {}, d0 = 20400;
addHistory(h, [box], d0); addHistory(h, [Object.assign({}, box, { mp: [20000, 20250, 1, ""] })], d0 + 1);
addHistory(h, [Object.assign({}, box, { mp: [20000, 21000, 1, ""] })], d0 + 2); addHistory(h, [Object.assign({}, box, { mp: [20000, 21500, 1, ""] })], d0 + 2);
ok(JSON.stringify(h[box.k]) === JSON.stringify([[d0, 20241], [d0 + 2, 21500]]), "history: a point only when the price moves (by 1% or more), today's latest price wins " + JSON.stringify(h[box.k]));
const old = { gone: [[d0 - 500, 100]] }; addHistory(old, [box], d0); ok(!old.gone && old[box.k], "products no longer listed for over a year drop out of the history");
