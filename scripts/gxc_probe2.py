"""Verify the GoExtraCash condition -> price model is additive."""
import json
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
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]


out = []
st, body = call("device/1089")
d = json.loads(body)
out.append("=== FULL device/1089 JSON ===")
out.append(json.dumps(d, indent=1))
out.append(f"\nMSP={d.get('msp')}  n_fields={len(d)}")

# which keys are price fields?
price_keys = [k for k, v in d.items() if isinstance(v, (int, float)) and k != "id"]
out.append(f"price_keys({len(price_keys)}): {price_keys}")

out.append("\n=== single-condition checkout vs /device deduction ===")
for k in price_keys:
    if k == "msp":
        continue
    st, b = call("checkout", {"id": 1089, k: "true"})
    try:
        got = json.loads(b).get("msp")
    except Exception:
        got = f"ERR {st} {b[:120]}"
    table = d.get(k)
    diff = (d["msp"] - got) if isinstance(got, (int, float)) else None
    match = "OK" if diff == table else "MISMATCH"
    out.append(f"{k:26s} table={table!s:>8}  checkout={got!s:>9}  diff={diff!s:>8}  {match}")

out.append("\n=== combination test (2 conditions) ===")
st, b = call("checkout", {"id": 1089, "scratches_minor": "true", "display_line": "true"})
out.append(f"scratches_minor+display_line -> {b}")
summed = d["msp"] - d["scratches_minor"] - d["display_line"]
out.append(f"expected additive = {summed}")

out.append("\n=== 3 conditions ===")
st, b = call("checkout", {"id": 1089, "scratches_crack": "true",
                          "notworking_battery": "true", "warranty_12mmore": "true"})
out.append(f"crack+no_battery+warranty_expired -> {b}")
out.append(f"expected additive = {d['msp'] - d['scratches_crack'] - d['notworking_battery'] - d['warranty_12mmore']}")

print("\n".join(out))
