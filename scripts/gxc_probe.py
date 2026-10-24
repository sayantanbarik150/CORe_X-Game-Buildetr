"""Probe GoExtraCash pricing endpoints to learn the condition -> price model."""
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
            return r.status, r.read().decode("utf-8", "replace")[:500]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]
    except Exception as e:  # noqa: BLE001
        return "ERR", repr(e)[:200]


out = []
for p in ["device/1089", "msp/1089", "msp/1090", "device/1090",
          "msp/IPHONE%2013", "device/IPHONE%2013", "msp/iphone13",
          "variants/IPHONE%2013", "devices/IPHONE%2013"]:
    out.append(f"GET {p} -> {call(p)}")

out.append("")
st, body = call("order/initiate", {"id": 1089})
out.append(f"POST order/initiate -> {st} {body}")
oid = ""
try:
    oid = json.loads(body).get("order_id", "")
except Exception:
    pass
out.append(f"ORDER_ID={oid!r}")

variants = {
    "BEST": {"available_charger": "true", "available_earphone": "true",
             "available_box": "true", "available_bill": "true",
             "warranty_12mmore": "true"},
    "WORST": {"scratches_crack": "true", "display_heavyspot": "true",
              "touch_notworking": "true", "panel_crack": "true",
              "body_dent_major": "true", "body_scratch_major": "true",
              "notworking_battery": "true", "warranty_1month": "true"},
    "MID": {"scratches_minor": "true", "body_scratch_minor": "true",
            "available_charger": "true", "available_box": "true",
            "warranty_12month": "true"},
    "MINIMAL": {},
}
for name, ch in variants.items():
    payload = {"id": 1089, "order_id": oid, **ch}
    out.append(f"POST checkout {name} -> {call('checkout', payload)}")

out.append(f"POST checkout NO_ORDER -> {call('checkout', {'id': 1089})}")
out.append(f"POST checkout BOGUS_ORDER -> {call('checkout', {'id': 1089, 'order_id': 'TEST-BOGUS-000'})}")

print("\n".join(out))
