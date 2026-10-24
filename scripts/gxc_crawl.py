"""Crawl the complete GoExtraCash price catalog.

Structure discovered in the site's Angular bundle:

  GET  /brands                     -> [{id, name, logo}]
  GET  /series/{brand}             -> [{id, brand, series}]
  GET  /devices/{series}           -> [{model, model_pic}]
  GET  /variants/{model}           -> [{model, ram, rom, id}]   (id = variant id)
  GET  /device/{variant_id}        -> full price table for that variant:
                                      msp + a deduction amount for every condition

  POST /checkout {id, <condition>: "true", ...} -> {msp: quoted price}
        (verified: quoted price == msp - sum(selected deductions), i.e. additive)

Writes data/catalog.json, data/variants.json (+ data/raw/device_<id>.json cache).
"""
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api.goextracash.com/"
HDRS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Origin": "https://www.goextracash.com",
    "Referer": "https://www.goextracash.com/",
}
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
RAW = os.path.join(OUT, "raw")
os.makedirs(RAW, exist_ok=True)

lock = threading.Lock()
stats = {"ok": 0, "fail": 0, "skip": 0}


def get(path, tries=4):
    url = API + urllib.parse.quote(path, safe="/?=&")
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HDRS)
            with urllib.request.urlopen(req, timeout=45) as r:
                body = r.read().decode("utf-8", "replace")
            return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 + attempt * 3 + random.random())
                continue
            return None
        except Exception as e:  # noqa: BLE001
            last = repr(e)[:120]
            time.sleep(1.5 + attempt * 2)
    print(f"  !! give up {path}: {last}", flush=True)
    return None


def save(obj, name):
    path = os.path.join(OUT, name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


# ---------------------------------------------------------------- discovery
brands = get("brands") or []
print(f"brands: {len(brands)}", flush=True)

catalog = {"scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "brands": []}
series_rows = []
model_rows = []
variant_rows = []

for b in brands:
    bname = b["name"]
    series = get(f"series/{bname}") or []
    print(f"  {bname}: {len(series)} series", flush=True)
    catalog["brands"].append({**b, "series": series})
    for s in series:
        series_rows.append({"brand": bname, "series": s["series"], "series_id": s.get("id")})
        devices = get(f"devices/{s['series']}") or []
        for d in devices:
            model_rows.append({"brand": bname, "series": s["series"], "model": d["model"]})
            variants = get(f"variants/{d['model']}") or []
            for v in variants:
                variant_rows.append({
                    "brand": bname,
                    "series": s["series"],
                    "model": v["model"],
                    "ram": v.get("ram"),
                    "rom": v.get("rom"),
                    "variant_id": v["id"],
                })
    save(catalog, "catalog.json")
    save(series_rows, "series.json")
    save(model_rows, "models.json")
    save(variant_rows, "variants_meta.json")

print(f"series={len(series_rows)} models={len(model_rows)} variants={len(variant_rows)}",
      flush=True)

# ------------------------------------------------------------------ details
todo = [v for v in variant_rows
        if not os.path.exists(os.path.join(RAW, f"{v['variant_id']}.json"))]
print(f"detail requests needed: {len(todo)}", flush=True)


def fetch_device(v):
    vid = v["variant_id"]
    path = os.path.join(RAW, f"{vid}.json")
    if os.path.exists(path):
        with lock:
            stats["skip"] += 1
        return
    d = get(f"device/{vid}")
    if not d:
        with lock:
            stats["fail"] += 1
        return
    d["_brand_hint"] = v["brand"]
    d["_series_hint"] = v["series"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False)
    with lock:
        stats["ok"] += 1
        if stats["ok"] % 200 == 0:
            print(f"  fetched {stats['ok']}/{len(todo)} (fail={stats['fail']})", flush=True)


start = time.time()
BUDGET = float(os.environ.get("CRAWL_BUDGET_SEC", "12000"))
with ThreadPoolExecutor(max_workers=6) as pool:
    futures = []
    for i, v in enumerate(todo):
        futures.append(pool.submit(fetch_device, v))
        time.sleep(0.02)  # be polite
        if time.time() - start > BUDGET:
            print("budget reached, stopping early", flush=True)
            break
    for f in futures:
        f.result()

# ------------------------------------------------------------------ assemble
devices = []
for v in variant_rows:
    path = os.path.join(RAW, f"{v['variant_id']}.json")
    if not os.path.exists(path):
        continue
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    devices.append({**v, "detail": d})

save(devices, "devices_full.json")
print(f"DONE ok={stats['ok']} fail={stats['fail']} skip={stats['skip']} "
      f"with_detail={len(devices)} in {time.time() - start:.0f}s", flush=True)
