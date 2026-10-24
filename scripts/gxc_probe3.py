"""Determine how GoExtraCash combines multiple deductions (cap / floor rule)."""
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
            b = r.read().decode("utf-8", "replace")
            return json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        return {"_err": e.code}
    except Exception as e:  # noqa: BLE001
        return {"_err": repr(e)[:80]}


def analyse(vid, combos, title):
    d = call(f"device/{vid}")
    msp = d["msp"]
    keymap = {k: v for k, v in d.items() if isinstance(v, (int, float))}
    print(f"\n########## {title} variant={vid} msp={msp}")
    print(f"{'conditions':58s} {'sum':>8} {'additive':>10} {'actual':>10} {'delta':>9}")
    for combo in combos:
        payload = {"id": vid}
        s = 0
        for c in combo:
            payload[c] = "true"
            s += keymap.get(c, 0)
        r = call("checkout", payload)
        actual = r.get("msp") if isinstance(r, dict) else None
        add = msp - s
        delta = (actual - add) if isinstance(actual, (int, float)) else None
        print(f"{'+'.join(combo)[:58]:58s} {s:8.0f} {add:10.0f} {actual!s:>10} {delta!s:>9}")


analyse(1089, [
    ["face"],
    ["face", "wifi"],
    ["scratches_glass", "face", "wifi"],
    ["scratches_glass", "face", "wifi", "notworking_battery"],
    ["scratches_glass", "face", "wifi", "notworking_battery", "available_box"],
    ["mobile_off", "wifi"],
    ["touch_notworking", "scratches_crack", "notworking_face", "notworking_battery",
     "notworking_wifi", "available_box", "warranty_12month"],
    ["scratches_crack", "display_heavyspot", "touch_notworking", "panel_crack",
     "body_dent_major", "body_scratch_major", "notworking_battery", "warranty_1month"],
    ["mobile_off", "touch_notworking", "scratches_glass"],
], "IPHONE 13 128GB")

analyse(1091, [
    ["face"],
    ["face", "wifi", "scratches_glass"],
    ["mobile_off"],
    ["mobile_off", "wifi"],
], "IPHONE 13 512GB")
