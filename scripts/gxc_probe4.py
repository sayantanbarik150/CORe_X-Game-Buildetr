"""Cross-check the additive price model on a random sample of variants."""
import json
import random
import urllib.request
import urllib.error

API = "https://api.goextracash.com/"
HDRS = {"Accept": "application/json", "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def call(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, headers=HDRS,
                                 method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            b = r.read().decode("utf-8", "replace")
            return json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        return {"_err": e.code}


with open("data/devices_full.json", encoding="utf-8") as f:
    rows = json.load(f)

random.seed(7)
sample = random.sample(rows, 12)
singles = ["scratches_minor", "display_line", "notworking_wifi", "body_dent_minor",
           "available_box", "warranty_12month", "notworking_face", "panel_crack",
           "scratches_heavy", "notworking_charging"]

ok = bad = 0
print(f"{'variant':8s} {'model':22s} {'combo':52s} {'expected':>9} {'actual':>9} {'match'}")
for r in sample:
    d = r["detail"]
    msp = d["msp"]
    vid = r["variant_id"]
    for _ in range(3):
        combo = random.sample(singles, random.choice([1, 2, 3]))
        payload = {"id": vid}
        s = 0
        for c in combo:
            payload[c] = "true"
            s += d.get(c, 0)
        expected = msp - s
        if expected < 0.35 * msp:      # keep inside the verified additive range
            continue
        got = call("checkout", payload)
        actual = got.get("msp") if isinstance(got, dict) else None
        match = actual is not None and abs(actual - expected) < 0.51
        ok += bool(match)
        bad += (not match)
        print(f"{vid:<8} {d['model'][:22]:22s} {'+'.join(combo)[:52]:52s} "
              f"{expected:9.0f} {actual if actual is not None else 'ERR':>9} {match}")

print(f"\nmatched={ok} mismatched={bad}")
