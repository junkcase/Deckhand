// The daily Mana Pool copy: conversion keeps only what Deckhand needs, rejects junk, and stays small.
const { convert } = require("../../tools/manapool-mirror.js");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const real = { meta: { as_of: "2026-11-04T03:19:25.352Z", base_url: "https://manapool.com" }, data: [
  { name: "\"Ach! Hans, Run!\"", set_code: "UNH", number: "116", scryfall_id: "84f2c8f5-8e11-4639-b7de-00e4a2cbabee", available_quantity: 26, price_cents: 244, price_cents_lp_plus: 287, price_cents_nm: 307, price_cents_foil: 1751, price_cents_etched: null, price_market: 243, url: "https://manapool.com/card/unh/116/ach-hans-run" },
  { name: "Nothing listed", scryfall_id: "00000000-0000-0000-0000-000000000001", price_cents: null, price_cents_nm: null, price_cents_foil: null, price_cents_etched: null, url: "https://manapool.com/card/x/1/nothing" },
  { name: "Bad id", scryfall_id: "../../etc", price_cents: 5, url: "https://manapool.com/card/x/1/bad" },
  { name: "Odd url", scryfall_id: "AB000000-0000-0000-0000-000000000002", price_cents: 100, url: "javascript:alert(1)" } ] };
const { meta, shards } = convert(real);
ok(meta.cards === 2 && meta.as_of === real.meta.as_of, `keeps priced cards only (${meta.cards}), with the date`);
ok(JSON.stringify(shards["84"]["84f2c8f5-8e11-4639-b7de-00e4a2cbabee"]) === '[244,307,1751,null,"unh/116/ach-hans-run"]', "row: lowest, NM, foil, etched, card page " + JSON.stringify(shards["84"]));
ok(!JSON.stringify(shards).includes("etc") && shards["ab"]["ab000000-0000-0000-0000-000000000002"][4] === "", "bad IDs dropped, odd links blanked, IDs lower-cased");
let threw = false; try { convert({ meta: {} }); } catch (e) { threw = true; } ok(threw, "an unexpected response is an error (yesterday's copy stays)");
// size at Mana Pool's scale (~110,000 printings)
const big = { meta: real.meta, data: [] };
for (let i = 0; i < 110000; i++) { const h = (i * 2654435761 >>> 0).toString(16).padStart(8, "0"); big.data.push({ scryfall_id: `${h}-1234-4abc-9def-${String(i).padStart(12, "0")}`, price_cents: 25 + i % 5000, price_cents_nm: 30 + i % 5000, price_cents_foil: i % 3 ? null : 99, url: `https://manapool.com/card/set${i % 900}/${i % 400}/some-card-name-${i % 997}` }); }
const t0 = Date.now(), B = convert(big), sizes = Object.values(B.shards).map(v => JSON.stringify(v).length), tot = sizes.reduce((a, b) => a + b, 0);
console.log(`     110k printings → ${Object.keys(B.shards).length} files, ${(tot / 1e6).toFixed(1)} MB total, ${(Math.max(...sizes) / 1e3).toFixed(0)} KB largest, ${Date.now() - t0} ms`);
ok(Object.keys(B.shards).length === 256 && Math.max(...sizes) < 80000, "a deck only downloads the small files it needs (under 80 KB each)");
