"""Probe GoExtraCash pricing endpoints to learn the condition -> price model."""
import json
import urllib.request

API = "https://api.goextracash.com/"
HDRS = {"Accept": "application/json", "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"}


def get(path):
    req = urllib.request.Request(API + path, headers=HDRS)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.status, r.read().decode("utf-8", "replace")


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(API + path, data=data, headers=HDRS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


out = []
out.append("=== GET msp/1089 ===")
out.append(str(get("msp/1089")))
out.append("=== GET device/1089 ===")
out.append(str(get("device/1089")))

out.append("=== POST order/initiate ===")
st, body = post("order/initiate", {"id": 1089})
out.append(f"{st} {body}")
oid = ""
try:
    oid = json.loads(body).get("order_id", "")
except Exception:
    pass
out.append(f"ORDER_ID={oid!r}")

best = {"id": 1089, "order_id": oid, "available_charger": "true",
        "available_earphone": "true", "available_box": "true",
        "available_bill": "true", "warranty_12mmore": "true"}
out.append("=== checkout BEST ===")
out.append(str(post("checkout", best)))

worst = {"id": 1089, "order_id": oid, "scratches_crack": "true",
         "display_heavyspot": "true", "touch_notworking": "true",
         "panel_crack": "true", "body_dent_major": "true",
         "body_scratch_major": "true", "notworking_battery": "true",
         "warranty_1month": "true"}
out.append("=== checkout WORST ===")
out.append(str(post("checkout", worst)))

mid = {"id": 1089, "order_id": oid, "scratches_minor": "true",
       "body_scratch_minor": "true", "available_charger": "true",
       "available_box": "true", "warranty_12month": "true"}
out.append("=== checkout MID ===")
out.append(str(post("checkout", mid)))

out.append("=== checkout NO order_id ===")
out.append(str(post("checkout", {"id": 1089, "warranty_12mmore": "true"})))

out.append("=== checkout BOGUS order_id ===")
out.append(str(post("checkout", {"id": 1089, "order_id": "TEST-BOGUS-000",
                                 "warranty_12mmore": "true"})))

out.append("=== checkout MINIMAL (id only) ===")
out.append(str(post("checkout", {"id": 1089})))

print("\n".join(out))
