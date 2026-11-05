"""Daily price history for every printing, up to a year, for Deckhand's price charts.

Sources (all public):
  - MTGJSON AllPrices: the last 90 days of TCGplayer market and Card Kingdom buylist prices, keyed by MTGJSON id
  - MTGJSON cardIdentifiers.csv: MTGJSON id -> Scryfall id
  - today's Mana Pool copy (out/manapool), made earlier in the same job
History builds up day by day: each run keeps what older runs saved and adds the newest 90 days, so the chart
reaches a full year after a year of runs. Only changes are stored (a point when the price moves by at least
1 cent and 1%), which keeps a year of history small.

Output: out/history/meta.json and out/history/<3 hex>.json, keyed by Scryfall id:
  { id: { "t": [[day, cents], ...], "tf": ..., "kb": ..., "kbf": ..., "m": ..., "mf": ... } }
  t/tf = TCGplayer market normal/foil, kb/kbf = Card Kingdom buylist normal/foil, m/mf = Mana Pool lowest listing.
  day = days since 2020-01-01 (UTC).

Also writes the biggest risers (and fallers: falling.json, falling/<set>.json) over the last 30 days (TCGplayer market), for the Staples "Rising" ranking:
  out/history/rising.json (every set) and out/history/rising/<set code>.json: [[id, set, now cents, 30 days ago cents, foil 0/1], ...]
  Set codes come from MTGJSON's cards.csv (optional 4th argument).

Usage: python3 price-history.py OUT_DIR ALLPRICES_JSON CARD_IDENTIFIERS_CSV [CARDS_CSV]
"""
import csv, datetime, json, os, sys

EPOCH = datetime.date(2020, 1, 1)
KEEP_DAYS = 400
SERIES = {  # our name: (MTGJSON provider, list, finish)
    "t": ("tcgplayer", "retail", "normal"), "tf": ("tcgplayer", "retail", "foil"),
    "kb": ("cardkingdom", "buylist", "normal"), "kbf": ("cardkingdom", "buylist", "foil"),
}


def day_of(s):
    return (datetime.date.fromisoformat(s[:10]) - EPOCH).days


def compress(points):
    """[(day, cents)] sorted by day -> keep only real changes (and the last point, so 'now' is known)."""
    out = []
    for d, c in points:
        if c is None or c <= 0:
            continue
        if out:
            prev = out[-1][1]
            if abs(c - prev) < max(1, prev * 0.01):
                continue
        out.append([d, c])
    if points and out and points[-1][0] != out[-1][0] and points[-1][1]:
        out.append([points[-1][0], out[-1][1]])          # still the same price on the latest day
    return out


def expand(points, start, end):
    """change points -> {day: cents} for start..end (carrying the price forward)."""
    res, cur, i = {}, None, 0
    for d in range(start, end + 1):
        while i < len(points) and points[i][0] <= d:
            cur = points[i][1]; i += 1
        if cur is not None:
            res[d] = cur
    return res


def load_old(out):
    hist = {}
    d = os.path.join(out, "history")
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".json") and f not in ("meta.json", "rising.json", "falling.json"):
                with open(os.path.join(d, f)) as fh:
                    hist.update(json.load(fh))
    return hist


def at_day(points, day):
    v = None
    for d, c in points:
        if d > day:
            break
        v = c
    return v


def window_median(points, start, end):
    vals = sorted(v for v in (at_day(points, d) for d in range(start, end + 1)) if v is not None)
    return vals[len(vals) // 2] if len(vals) == end - start + 1 else None


def rising(hist, sets, today_day, days=30, per_set=60, overall=250, falling=False):
    """Cards whose TCGplayer market price went up (or, falling=True, down) most over `days` (normal, or foil for foil-only
    cards). Rises of more than 10x, and drops of more than 75%, are taken as bad data. Cheap cards are left out: now and then at least 50c
    for the price that's higher, 25c for the lower one."""
    rows = []
    for sf, v in hist.items():
        for key, foil in (("t", 0), ("tf", 1)):
            pts = v.get(key)
            if not pts or (foil and v.get("t")):
                continue
            # medians of a few days at each end, so one odd sale (common on thin foil markets) doesn't count as a rise
            now, then = window_median(pts, today_day - 4, today_day), window_median(pts, today_day - days - 3, today_day - days + 3)
            if now is None or then is None:
                continue
            hi, lo = (then, now) if falling else (now, then)
            if hi < 50 or lo < 25 or hi < lo * 1.05 or hi > lo * (4 if falling else 10):      # drops beyond -75% are almost always a bad price at one end
                continue
            rows.append([sf, sets.get(sf, ""), now, then, foil])
    rows.sort(key=lambda r: ((r[2] - r[3]) / r[3], -r[3]) if falling else (-(r[2] - r[3]) / r[3], -r[2]))
    by_set = {}
    for r in rows:
        if r[1] and len(by_set.setdefault(r[1], [])) < per_set:
            by_set[r[1]].append(r)
    return rows[:overall], by_set


def main(out, prices_path, ids_path, today=None, cards_path=None):
    import ijson
    today_day = (today or (datetime.datetime.utcnow().date() - EPOCH).days)
    uuid2sf = {}
    with open(ids_path, newline="") as fh:
        for row in csv.DictReader(fh):
            if row.get("scryfallId"):
                uuid2sf[row["uuid"]] = row["scryfallId"].lower()
    hist = load_old(out)
    fresh = {}  # sf id -> series -> {day: cents}
    with open(prices_path, "rb") as fh:
        for uuid, entry in ijson.kvitems(fh, "data", use_float=True):
            sf = uuid2sf.get(uuid)
            paper = (entry or {}).get("paper") or {}
            if not sf or not paper:
                continue
            for key, (prov, lst, fin) in SERIES.items():
                vals = ((paper.get(prov) or {}).get(lst) or {}).get(fin) or {}
                if vals:
                    fresh.setdefault(sf, {})[key] = {day_of(k): round(v * 100) for k, v in vals.items() if isinstance(v, (int, float))}
    # today's Mana Pool lowest listing
    mp_dir = os.path.join(out, "manapool")
    if os.path.isdir(mp_dir):
        for f in os.listdir(mp_dir):
            if f.endswith(".json") and f not in ("meta.json", "rising.json", "falling.json"):
                with open(os.path.join(mp_dir, f)) as fh:
                    for sf, row in json.load(fh).items():
                        if row[0]: fresh.setdefault(sf, {}).setdefault("m", {})[today_day] = row[0]
                        if row[2]: fresh.setdefault(sf, {}).setdefault("mf", {})[today_day] = row[2]
    # merge: older saved history + the fresh window (fresh wins where both have a day)
    cutoff = today_day - KEEP_DAYS
    for sf in set(hist) | set(fresh):
        old, new, merged = hist.get(sf, {}), fresh.get(sf, {}), {}
        for key in set(old) | set(new):
            days = {}
            o = old.get(key) or []
            if o:
                days.update(expand(o, o[0][0], max(today_day if key in ("m", "mf") else o[-1][0], o[-1][0])))
            for d, c in (new.get(key) or {}).items():
                days[d] = c
            pts = compress(sorted((d, c) for d, c in days.items() if d >= cutoff))
            if pts:
                merged[key] = pts
        if merged:
            hist[sf] = merged
        else:
            hist.pop(sf, None)
    d = os.path.join(out, "history")
    os.makedirs(d, exist_ok=True)
    import shutil
    for f in os.listdir(d):
        q = os.path.join(d, f)
        shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
    shards = {}
    for sf, v in hist.items():
        shards.setdefault(sf[:3], {})[sf] = v
    total = 0
    for k, v in shards.items():
        s = json.dumps(v, separators=(",", ":"))
        total += len(s)
        with open(os.path.join(d, k + ".json"), "w") as fh:
            fh.write(s)
    sets = {}
    if cards_path and os.path.exists(cards_path):
        csv.field_size_limit(10 ** 8)
        with open(cards_path, newline="") as fh:
            for row in csv.DictReader(fh):
                sf = uuid2sf.get(row.get("uuid"))
                if sf and row.get("setCode"):
                    sets[sf] = row["setCode"].lower()
    for name, down in (("rising", False), ("falling", True)):
        top, by_set = rising(hist, sets, today_day, falling=down)
        rd = os.path.join(d, name)
        os.makedirs(rd, exist_ok=True)
        with open(os.path.join(d, name + ".json"), "w") as fh:      # not in rising/, where it would clash with a set coded "all" (Alliances)
            json.dump(top, fh, separators=(",", ":"))
        for code, rows in by_set.items():
            if code.replace("_", "").isalnum():
                with open(os.path.join(rd, code + ".json"), "w") as fh:
                    json.dump(rows, fh, separators=(",", ":"))
        print(f"{name}: {len(top)} overall, {len(by_set)} sets")
    first = min((p[0][0] for v in hist.values() for p in v.values()), default=today_day)
    with open(os.path.join(d, "meta.json"), "w") as fh:
        json.dump({"as_of": (EPOCH + datetime.timedelta(days=today_day)).isoformat(), "cards": len(hist), "from": (EPOCH + datetime.timedelta(days=first)).isoformat(),
                   "epoch": EPOCH.isoformat(), "series": {"t": "TCGplayer market", "tf": "TCGplayer market (foil)", "kb": "Card Kingdom buylist", "kbf": "Card Kingdom buylist (foil)", "m": "Mana Pool lowest", "mf": "Mana Pool lowest (foil)"}}, fh)
    print(f"history: {len(hist)} cards in {len(shards)} files, {total / 1e6:.1f} MB, from {first} to {today_day}")
    return hist


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], cards_path=sys.argv[4] if len(sys.argv) > 4 else None)
