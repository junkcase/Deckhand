// Card Kingdom copy: buy prices and how many they want, normal and foil, keyed by Scryfall ID.
const { convert } = require("../../tools/cardkingdom-mirror.js");
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const id = "803fd65f-4ca6-4fe4-abc2-72aa32ebb3a5";
const { meta, shards } = convert({ meta: { created_at: "2026-11-04 06:03:48" }, data: [
  { scryfall_id: id, url: "mtg/3rd-edition/sol-ring", is_foil: "false", price_buy: "11.50", qty_buying: 29 },
  { scryfall_id: id.toUpperCase(), url: "mtg/3rd-edition-foil/sol-ring", is_foil: "true", price_buy: "40.00", qty_buying: 0 },
  { scryfall_id: "a363bc91-8278-448e-9d5c-564e4b51eb62", url: "mtg/4th-edition/abomination", is_foil: "false", price_buy: "0.00", qty_buying: 0 },
  { scryfall_id: "../x", url: "javascript:1", price_buy: "5" }, { scryfall_id: "ab000000-0000-0000-0000-000000000002", url: "javascript:alert(1)", is_foil: "false", price_buy: "2.00", qty_buying: 3 } ] });
ok(JSON.stringify(shards["80"][id]) === '[1150,4000,29,0,"mtg/3rd-edition/sol-ring"]', "normal and foil buy prices with quantities wanted, and the product page " + JSON.stringify(shards["80"][id]));
ok(meta.cards === 2 && meta.as_of === "2026-11-04T06:03:48Z", `only cards with a buy price (${meta.cards}), with the date`);
ok(shards["ab"]["ab000000-0000-0000-0000-000000000002"][4] === "", "odd links are blanked");
let threw = false; try { convert({}); } catch (e) { threw = true; } ok(threw, "an unexpected response is an error (yesterday's copy stays)");
