"""Daily market opportunities for Deckhand's Market tab, from data the daily job already has plus Scryfall's daily card file.

Each candidate qualified under a strategy by measurable conditions, and carries the evidence (numbers) and the risk
factors in plain words. Nothing here predicts prices, and nothing is called "undervalued": the evidence is the claim.

Inputs (all from the same run): out/history (price history: t/tf TCGplayer market, kb/kbf Card Kingdom buylist,
m/mf Mana Pool lowest; days since 2020-01-01), out/manapool and out/cardkingdom (today's store prices), Scryfall's
default-cards file, one card per line (printings, set, EDHREC rank, Reserved List). Out: out/opps/all.json, out/opps/ranks.json (EDHREC
rank recorded daily, so a real "rising demand" signal can exist once there's a month of it).

Usage: python3 opportunities.py OUT_DIR SCRYFALL_DEFAULT_CARDS_JSON [TODAY_DAY]
"""
import datetime, json, os, sys

EPOCH = datetime.date(2020, 1, 1)
TOP = 60
REPRINT_KINDS = {"masters", "commander", "arsenal", "spellbook", "from_the_vault", "duel_deck"}


def money(c):
    return f"${c / 100:,.2f}"


def at_day(points, day):
    v = None
    for d, c in points:
        if d > day:
            break
        v = c
    return v


def med(points, start, end):
    vals = sorted(v for v in (at_day(points, d) for d in range(start, end + 1)) if v is not None)
    return vals[len(vals) // 2] if len(vals) == end - start + 1 else None


def pct(a, b):
    return (a - b) / b * 100


def load_shards(d):
    out = {}
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".json") and f not in ("meta.json", "rising.json", "falling.json"):
                with open(os.path.join(d, f)) as fh:
                    out.update(json.load(fh))
    return out


def meta_date(path):
    try:
        with open(path) as fh:
            return json.load(fh).get("as_of")
    except Exception:
        return None


def scryfall_cards(path):
    """id -> printing facts; oracle -> printings summary. Streams the ~500 MB file."""
    import gzip
    cards, oracle = {}, {}

    def items():          # Scryfall's file is one card per line (.jsonl, often gzipped); an older single JSON list also works
        opener = gzip.open if path.endswith(".gz") else open
        with opener(path, "rb") as fh:
            first = fh.read(1).lstrip()
        with opener(path, "rb") as fh:
            if first == b"[":
                import ijson
                yield from ijson.items(fh, "item", use_float=True)
            else:
                for line in fh:
                    line = line.strip().rstrip(b",")
                    if line and line not in (b"[", b"]"):
                        yield json.loads(line)
    for c in items():
        if c.get("digital") or "paper" not in (c.get("games") or []) or c.get("layout") in ("art_series", "token", "double_faced_token", "emblem"):
            continue
        o = c.get("oracle_id") or (c.get("card_faces") or [{}])[0].get("oracle_id")
        if not o:
            continue
        cards[c["id"]] = {"name": c["name"], "set": c["set"], "setName": c["set_name"], "num": c["collector_number"], "rarity": c.get("rarity"),
                          "o": o, "er": c.get("edhrec_rank"), "stype": c.get("set_type"), "basic": "Basic Land" in (c.get("type_line") or "")}
        s = oracle.setdefault(o, {"sets": {}, "reserved": False, "er": None})
        s["reserved"] = s["reserved"] or bool(c.get("reserved"))
        if c.get("edhrec_rank"):
            s["er"] = c["edhrec_rank"]
        s["sets"].setdefault(c["set"], (c.get("released_at") or "", c.get("set_type") or "", c["set_name"]))
    return cards, oracle


def reprint_risks(o, today):
    if not o:
        return []
    if o["reserved"]:
        return ["On the Reserved List: Wizards' published policy is not to reprint it."]
    now = (EPOCH + datetime.timedelta(days=today)).isoformat()
    sets = sorted(v for v in o["sets"].values() if v[0] and v[0] <= now)
    coming = [v for v in o["sets"].values() if v[0] > now]
    out = []
    if coming:
        out.append(f"Confirmed new printing: {coming[0][2]} ({coming[0][0]}).")
    recent = [s for s in sets if s[0] >= (EPOCH + datetime.timedelta(days=today - 3 * 365)).isoformat()]
    kinds = {s[1] for s in sets} & REPRINT_KINDS
    if len(sets) >= 8:
        out.append(f"Reprinted often: {len(sets)} printings, {len(recent)} in the last 3 years.")
    elif recent and len(sets) > 1:
        out.append(f"{len(recent)} printing{'s' if len(recent) != 1 else ''} in the last 3 years.")
    if kinds:
        out.append("Has been in reprint-focused products (" + ", ".join(sorted(kinds)).replace("_", " ") + ").")
    return out


def main(out, scry, today=None):
    today = today or (datetime.datetime.now(datetime.timezone.utc).date() - EPOCH).days
    hist = load_shards(os.path.join(out, "history"))
    mp, ck = load_shards(os.path.join(out, "manapool")), load_shards(os.path.join(out, "cardkingdom"))
    cards, oracle = scryfall_cards(scry)
    # EDHREC rank, recorded each day (change points only) so rising demand can be measured later
    rp = os.path.join(out, "opps", "ranks.json")
    try:
        with open(rp) as fh:
            ranks = json.load(fh)
    except Exception:
        ranks = {"since": today, "r": {}}
    for o, s in oracle.items():
        if s["er"]:
            a = ranks["r"].setdefault(o, [])
            if not a or a[-1][1] != s["er"]:
                a.append([today, s["er"]])
            if len(a) > 40:
                del a[:-40]
    S = {k: [] for k in ("movers", "gaps", "played", "lows", "demand")}
    fresh = {"history": meta_date(os.path.join(out, "history", "meta.json")), "manapool": meta_date(os.path.join(out, "manapool", "meta.json")),
             "cardkingdom": meta_date(os.path.join(out, "cardkingdom", "meta.json")), "scryfall": (EPOCH + datetime.timedelta(days=today)).isoformat()}
    best_played = {}
    for sid, c in cards.items():
        if c["basic"] or c["stype"] == "memorabilia":       # gold borders, 30th Anniversary etc.: not tournament-legal, priced on their own terms
            continue
        h, o = hist.get(sid) or {}, oracle.get(c["o"])
        t = h.get("t")
        now = at_day(t, today) if t else None
        base = {"id": sid, "name": c["name"], "set": c["set"], "setName": c["setName"], "num": c["num"], "fin": "nonfoil"}
        risks = reprint_risks(o, today)
        rel = (o or {}).get("sets", {}).get(c["set"], ("",))[0]
        new_set = rel and rel >= (EPOCH + datetime.timedelta(days=today - 180)).isoformat()
        m7 = med(t, today - 9, today - 5) if t else None
        m30 = med(t, today - 33, today - 27) if t else None
        mnow = med(t, today - 4, today) if t else None          # five days, so a one- or two-day spike doesn't count
        ch7 = round(pct(mnow, m7), 1) if mnow and m7 else None
        ch30 = round(pct(mnow, m30), 1) if mnow and m30 else None
        row = dict(base, price=now, ch7=ch7, ch30=ch30)
        mrow, krow = mp.get(sid), ck.get(sid)
        thin = [] if mrow else ["No Mana Pool listings today: a thin market can swing on a few sales."]
        # 1. big movers: a sustained rise (medians at both ends, so one odd sale doesn't count)
        if mnow and m7 and m30 and mnow >= 100 and ch7 is not None and ch30 is not None and ch30 >= 20 and mnow <= m30 * 10:
            ev = [f"TCGplayer market {money(m30)} a month ago → {money(mnow)} now ({ch30:+.0f}%), {ch7:+.0f}% in the last week."]
            r = list(risks) + thin + (["Most of the rise came in the last week: recent jumps often settle back."] if ch7 >= 0.6 * ch30 else []) \
                + (["The price more than tripled in a month: moves this size on cheaper cards often come from a few sales or a buyout."] if mnow >= m30 * 3 else [])
            S["movers"].append(dict(row, ev=ev, risk=r, score=ch30))
        # 2. store price gaps, same day
        if now and now >= 100 and krow and krow[0] and krow[0] >= now * 1.05 and krow[0] <= now * 1.5:      # a buylist far above market is almost always a mismatched printing
            S["gaps"].append(dict(row, ev=[f"Card Kingdom is paying {money(krow[0])} cash on its buylist; TCGplayer market is {money(now)} ({pct(krow[0], now):+.0f}%)." + (f" They want {krow[2]}." if krow[2] else "")],
                                  risk=risks + ["Buylist prices and wanted quantities change daily; check before selling.", "TCGplayer market is the price of recent sales, not a guaranteed buy price."], score=pct(krow[0], now)))
        if now and now >= 200 and mrow and mrow[0] and mrow[0] <= now * 0.7 and mrow[0] >= now * 0.5:      # listings far below market are nearly always damaged or another language
            S["gaps"].append(dict(row, ev=[f"Mana Pool's lowest listing is {money(mrow[0])}, {abs(pct(mrow[0], now)):.0f}% below TCGplayer market {money(now)}."],
                                  risk=risks + ["The lowest listing may be a single copy, a worse condition or a different language.", "TCGplayer market is the price of recent sales, not a guaranteed sell price."], score=-pct(mrow[0], now)))
        # 3. played a lot for its price (the cheapest priced printing of each card)
        if now and o and o["er"] and o["er"] <= 1000 and now <= 300:
            k = c["o"]
            if k not in best_played or now < best_played[k]["price"]:
                best_played[k] = dict(row, ev=[f"#{o['er']} on EDHREC (Commander play), and this printing is {money(now)}."],
                                      risk=risks + ["Play demand doesn't mean the price will rise: popular cards are often reprinted to keep them cheap."], score=-o["er"])
        # 4. at a 90-day low after a higher price (the history must cover most of the 90 days)
        if t and now and now >= 200 and t[0][0] <= today - 75:
            span = [v for v in (at_day(t, d) for d in range(today - 90, today + 1)) if v is not None]
            meds = [(med(t, d - 2, d + 2), d) for d in range(today - 88, today - 2)]
            meds = [m for m in meds if m[0] is not None]
            hi, hid = max(meds) if meds else (None, None)
            if hi and now <= min(span) and now <= hi * 0.75 and hi <= now * 4:
                S["lows"].append(dict(row, ev=[f"At its lowest TCGplayer price in 90 days: {money(now)}, down from {money(hi)} on {(EPOCH + datetime.timedelta(days=hid)).isoformat()}."],
                                      risk=risks + thin + (["Released " + rel + ": new cards usually fall from their release price, so this may be that drop."] if new_set else []) + ["A falling price can keep falling: a low isn't a floor."], score=pct(hi, now)))
        # 5. rising demand: EDHREC rank improving over 30+ days of records
        rk = ranks["r"].get(c["o"])
        if rk and today - ranks["since"] >= 30:
            r30, rnow = at_day(rk, today - 30), at_day(rk, today)
            if r30 and rnow and rnow <= r30 * 0.75 and r30 - rnow >= 200 and now:
                S["demand"].append(dict(row, o=c["o"], ev=[f"EDHREC rank went from #{r30} to #{rnow} in 30 days (more Commander decks play it)."],
                                        risk=risks + ["Rank measures decks built, not cards bought: it may not move the price."], score=pct(r30, rnow)))
    S["played"] = list(best_played.values())
    for k, rows in S.items():
        rows.sort(key=lambda r: -r["score"])
        seen, keep = set(), []
        for r in rows:
            if (r["name"], k) in seen and k != "gaps":
                continue
            seen.add((r["name"], k))
            r.pop("score", None); r.pop("o", None)
            keep.append(r)
        S[k] = keep[:TOP]
    d = os.path.join(out, "opps")
    os.makedirs(d, exist_ok=True)
    with open(rp, "w") as fh:
        json.dump(ranks, fh, separators=(",", ":"))
    body = {"as_of": (EPOCH + datetime.timedelta(days=today)).isoformat(), "fresh": fresh, "rankSince": (EPOCH + datetime.timedelta(days=ranks["since"])).isoformat(), "strategies": S}
    with open(os.path.join(d, "all.json"), "w") as fh:
        json.dump(body, fh, separators=(",", ":"))
    print("opportunities:", {k: len(v) for k, v in S.items()})
    return body


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else None)
