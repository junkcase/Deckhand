"""Daily copy of Commander Spellbook's combo list (commanderspellbook.com, a free community database), made small
enough for a phone, for Deckhand's Combos tab. Their API only accepts requests from their own website, so the app
reads this copy from the "data" branch instead.

Output: out/combos/meta.json and out/combos/all.json:
  { "as_of", "cards": [names], "feats": [what combos produce], "tmpl": [card descriptions like "a sac outlet"],
    "combos": [[id, [card index, ... (negative -i-1 = must be your commander)], [feat index, ...], [template index, ...],
                popularity, color identity], ...] }
Usage: python3 combos-mirror.py OUT_DIR VARIANTS_JSON(.gz)
"""
import gzip, json, os, sys


def main(out, src):
    import ijson
    opener = gzip.open if src.endswith(".gz") else open
    cards, feats, tmpl, combos, as_of = {}, {}, {}, [], None
    idx = lambda d, k: d.setdefault(k, len(d))
    import re
    with opener(src, "rb") as fh:
        m = re.search(rb'"timestamp"\s*:\s*"([^"]+)"', fh.read(4096)); as_of = m.group(1).decode() if m else None
    with opener(src, "rb") as fh:
        for x in ijson.items(fh, "variants.item", use_float=True):      # one combo at a time: the full file is ~700 MB
            if x.get("status") != "OK" or len(x.get("uses") or []) > 5:
                continue
            uses = [(-idx(cards, u["card"]["name"]) - 1) if u.get("mustBeCommander") else idx(cards, u["card"]["name"]) for u in x["uses"]]
            prod = [p["feature"]["name"] for p in x.get("produces") or []]
            prod.sort(key=lambda n: (0 if n.lower().startswith(("win the game", "infinite")) else 1, len(n)))
            combos.append([x["id"], uses, [idx(feats, n) for n in prod[:3]], [idx(tmpl, r["template"]["name"]) for r in x.get("requires") or []],
                           int(x.get("popularity") or 0), x.get("identity") or "C"])
    combos.sort(key=lambda c: -c[4])
    inv = lambda d: [k for k, _ in sorted(d.items(), key=lambda kv: kv[1])]
    d = os.path.join(out, "combos")
    os.makedirs(d, exist_ok=True)
    body = {"as_of": as_of, "source": "Commander Spellbook (commanderspellbook.com)", "cards": inv(cards), "feats": inv(feats), "tmpl": inv(tmpl), "combos": combos}
    with open(os.path.join(d, "all.json.tmp"), "w") as fh:          # written whole, then swapped in: never a half file
        json.dump(body, fh, separators=(",", ":"))
    os.replace(os.path.join(d, "all.json.tmp"), os.path.join(d, "all.json"))
    with open(os.path.join(d, "meta.json"), "w") as fh:
        json.dump({"as_of": as_of, "combos": len(combos), "cards": len(cards), "source": body["source"]}, fh)
    print(f"combos: {len(combos)} combos, {len(cards)} cards, {os.path.getsize(os.path.join(d, 'all.json')) / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
