"""Build the GoExtraCash condition-wise price workbook from crawled data.

Input : data/devices_full.json  (one record per RAM/ROM variant, with the
        per-condition deduction table returned by api.goextracash.com/device/{id})
Output: output/GoExtraCash_Condition_Wise_Price_List.xlsx
"""
import json
import os
import statistics

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "devices_full.json")
OUTDIR = os.path.join(ROOT, "output")
os.makedirs(OUTDIR, exist_ok=True)
OUT = os.path.join(OUTDIR, "GoExtraCash_Condition_Wise_Price_List.xlsx")

INR = '"₹"#,##0'
PCT = '0.0%'

# --------------------------------------------------------------------------
# Condition catalogue (labels are the site's own wording, from its sell flow)
# --------------------------------------------------------------------------
CONDITIONS = [
    # (group, api key, label shown to the user as the answer that triggers it)
    ("Power", "mobile_off", "Phone does not switch on"),
    ("Screen", "touch_notworking", "Touch faulty / not working"),
    ("Screen", "display_heavyspot", "Heavy visible spots on display"),
    ("Screen", "display_multiplespot", "Multiple visible spots on display"),
    ("Screen", "display_smallspot", "Minor visible spots on display"),
    ("Screen", "display_line", "Visible line(s) on display"),
    ("Screen", "display_faded", "Display faded along corners"),
    ("Screen", "scratches_glass", "Glass broken"),
    ("Screen", "scratches_crack", "Screen cracked on edge"),
    ("Screen", "scratches_heavy", "Heavy scratches on screen"),
    ("Screen", "scratches_minor", "Minor scratches on screen"),
    ("Functionality", "notworking_frontcamera", "Front camera not working"),
    ("Functionality", "notworking_backcamera", "Back camera not working"),
    ("Functionality", "notworking_volume", "Volume button not working"),
    ("Functionality", "notworking_battery", "Battery problem"),
    ("Functionality", "notworking_speaker", "Speaker not working"),
    ("Functionality", "notworking_finger", "Fingerprint sensor not working"),
    ("Functionality", "notworking_power", "Power button not working"),
    ("Functionality", "notworking_charging", "Charging port not working"),
    ("Functionality", "notworking_wifi", "Wi-Fi not working"),
    ("Functionality", "notworking_face", "Face sensor not working"),
    ("Body", "body_scratch_major", "Major scratches on body"),
    ("Body", "body_scratch_minor", "Less than 2 body scratches"),
    ("Body", "body_dent_major", "Multiple / heavy dents"),
    ("Body", "body_dent_minor", "2 or less minor dents"),
    ("Body", "body_dent_ignorable", "Minor ignorable dents"),
    ("Body", "panel_crack", "Side / back panel cracked"),
    ("Body", "panel_missing", "Panel missing"),
    ("Body", "screen_bent", "Bent / curved panel"),
    ("Body", "screen_gap", "Loose screen gap"),
    ("Accessories", "available_charger", "Original charger not available"),
    ("Accessories", "available_box", "Box not available"),
    ("Accessories", "available_earphone", "Earphone not available"),
    ("Accessories", "available_bill", "Valid bill not available"),
    ("Warranty", "warranty_12mmore", "Out of warranty (above 12 months)"),
    ("Warranty", "warranty_12month", "Out of warranty (6-12 months)"),
    ("Warranty", "warranty_6month", "Out of warranty (3-6 months)"),
    ("Warranty", "warranty_3month", "Out of warranty (1-3 months)"),
    ("Warranty", "warranty_1month", "Out of warranty (below 1 month)"),
]

# Scenarios used for the headline "price by condition" sheet.
GRADES = [
    ("Flawless / Like New",
     "No defects, all accessories & bill available, still under warranty", []),
    ("Excellent",
     "Minor screen scratches + <2 body scratches, accessories + bill present, "
     "in warranty",
     ["scratches_minor", "body_scratch_minor"]),
    ("Good",
     "Heavy screen scratches + minor spots on display + minor body scratches "
     "and dents, box missing, out of warranty",
     ["scratches_heavy", "display_smallspot", "body_scratch_minor",
      "body_dent_minor", "available_box", "warranty_12month"]),
    ("Fair",
     "Screen cracked on edge + multiple spots + major body scratches and dents "
     "+ cracked back panel, no box/charger/bill, out of warranty",
     ["scratches_crack", "display_multiplespot", "body_scratch_major",
      "body_dent_major", "panel_crack", "available_box", "available_charger",
      "available_bill", "warranty_12month"]),
    ("Poor",
     "Touch faulty + glass broken + battery not working + heavy body dents + "
     "no box/charger, out of warranty",
     ["touch_notworking", "scratches_glass", "notworking_battery",
      "body_dent_major", "available_box", "available_charger",
      "warranty_12month"]),
]

# ------------------------------------------------------------------ styling
NAVY = "1F3864"
BLUE = "2F5597"
LIGHT = "D9E2F3"
BAND = "F2F5FB"
WHITE = "FFFFFF"
GREY = "808080"

H_FONT = Font(bold=True, color=WHITE, size=10, name="Calibri")
H_FILL = PatternFill("solid", fgColor=BLUE)
TITLE_FONT = Font(bold=True, size=16, color=NAVY, name="Calibri")
SUB_FONT = Font(size=10, color=GREY, italic=True, name="Calibri")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def style_header(ws, row=1, ncols=None, height=30):
    ncols = ncols or ws.max_column
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = H_FONT
        cell.fill = H_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center",
                                   wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = height


def autosize(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def band(ws, first_row, last_row, ncols):
    for r in range(first_row, last_row + 1):
        if (r - first_row) % 2 == 1:
            for c in range(1, ncols + 1):
                ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=BAND)


def add_table(ws, name, nrows, ncols):
    ref = f"A1:{get_column_letter(ncols)}{nrows}"
    tbl = Table(displayName=name, ref=ref)
    tbl.tableStyleInfo = TableStyleInfo(name="TableStyleLight1", showRowStripes=True)
    ws.add_table(tbl)


# --------------------------------------------------------------------- data
with open(SRC, encoding="utf-8") as f:
    rows = json.load(f)

devices = []
for r in rows:
    d = r.get("detail") or {}
    if not d.get("msp"):
        continue
    ded = {k: float(d.get(k) or 0) for k, _ in
           [(c[1], c[0]) for c in CONDITIONS]}
    devices.append({
        "brand": (d.get("brand") or r.get("brand") or "").strip(),
        "series": (d.get("series") or r.get("series") or "").strip(),
        "model": (d.get("model") or r.get("model") or "").strip(),
        "ram": d.get("ram") or r.get("ram"),
        "rom": d.get("rom") or r.get("rom"),
        "variant_id": r.get("variant_id") or d.get("id"),
        "msp": float(d["msp"]),
        "ded": ded,
        "raw": d,
        "updated": d.get("updated_at"),
    })

devices.sort(key=lambda x: (x["brand"].upper(), x["model"].upper(),
                            x["rom"] or 0, x["ram"] or 0))

print(f"devices with prices: {len(devices)}")


def price(dev, keys):
    return max(0.0, dev["msp"] - sum(dev["ded"].get(k, 0) for k in keys))


wb = Workbook()

# ------------------------------------------------------------------- Read Me
ws = wb.active
ws.title = "Read Me"
ws.sheet_view.showGridLines = False
ws["A1"] = "GoExtraCash – Condition-wise Price List"
ws["A1"].font = TITLE_FONT
ws["A2"] = ("All mobile models listed on goextracash.com with the price you get "
            "in each condition")
ws["A2"].font = Font(size=11, color=BLUE, bold=True)

brands = sorted({d["brand"] for d in devices})
lines = [
    ("Source", "https://www.goextracash.com/  (price data: api.goextracash.com)"),
    ("Scraped on", "see the 'Data' sheet – column 'Last updated (site)'"),
    ("Devices covered", f"{len(devices):,} RAM/ROM variants across "
                        f"{len(brands)} brands"),
    ("Brands", ", ".join(brands)),
    ("Highest price in file", f"₹{max(d['msp'] for d in devices):,.0f}"),
    ("Lowest price in file", f"₹{min(d['msp'] for d in devices):,.0f}"),
    ("", ""),
    ("How GoExtraCash prices a phone",
     "Every variant has a Maximum Selling Price (MSP) = what you get for a "
     "flawless phone with all accessories, bill and warranty. Each condition "
     "defect carries a fixed deduction. Final quote = MSP − sum of the "
     "deductions for the defects you select."),
    ("Verified", "Deductions were checked against the site's own quote API: "
                 "single defects and multi-defect combinations both matched "
                 "MSP − Σ deductions exactly."),
    ("", ""),
    ("Sheet: Price by Condition", "One row per variant. The price you get in "
                                  "each of 5 conditions (Flawless → Poor) plus "
                                  "the \"mobile not powering on\" price and the drop vs flawless."),
    ("Sheet: All Conditions", "Long format: one row per variant × condition "
                              "(~%d rows). Best for pivots: filter a model and "
                              "see the price for every single defect."
     % (len(devices) * len(CONDITIONS))),
    ("Sheet: Condition Deductions", "Raw deduction table per variant "
                                    "(₹ and % of MSP) exactly as published by "
                                    "the site."),
    ("Sheet: Brand Summary", "Counts and price ranges by brand."),
    ("Sheet: Data", "Flat export of every field returned by the price API."),
    ("", ""),
    ("Notes", "Prices are what GoExtraCash quotes before physical inspection; "
              "the site states the final price may change after evaluation. "
              "All amounts are in Indian Rupees (₹)."),
]
r = 4
for k, v in lines:
    ws.cell(row=r, column=1, value=k).font = Font(bold=True, size=10, color=NAVY)
    c = ws.cell(row=r, column=2, value=v)
    c.font = Font(size=10)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    if k:
        ws.row_dimensions[r].height = max(15, 15 * (len(v) // 90 + 1))
    r += 1
ws.column_dimensions["A"].width = 28
ws.column_dimensions["B"].width = 110
ws.cell(row=r + 1, column=1, value="Generated by Arena.ai agent").font = SUB_FONT

# ---------------------------------------------------------- Price by Condition
ws = wb.create_sheet("Price by Condition")
hdr = ["Brand", "Series", "Model", "RAM (GB)", "Storage (GB)", "Variant ID",
       "Flawless / Like New (₹)"]
for g, _, _ in GRADES[1:]:
    hdr.append(f"{g} (₹)")
hdr += ["Mobile not powering on (₹)", "Poor vs flawless"]

for c, h in enumerate(hdr, start=1):
    ws.cell(row=1, column=c, value=h)
style_header(ws)

for i, d in enumerate(devices, start=2):
    vals = [d["brand"], d["series"], d["model"], d["ram"], d["rom"], d["variant_id"],
            round(d["msp"])]
    grade_prices = []
    for g, _, keys in GRADES:
        p = price(d, keys)
        grade_prices.append(p)
        if g != "Flawless / Like New":
            vals.append(round(p))
    flawless = grade_prices[0]
    worst = min(grade_prices[1:])
    vals.append(round(price(d, ["mobile_off"])))
    vals.append(round(worst / flawless, 3) if flawless else 0)
    for c, v in enumerate(vals, start=1):
        cell = ws.cell(row=i, column=c, value=v)
        cell.border = BORDER
        if 7 <= c <= 12:
            cell.number_format = INR
        if c == 13:
            cell.number_format = INR
        if c == 14:
            cell.number_format = PCT

n = len(devices) + 1
band(ws, 2, n, len(hdr))
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(hdr))}{n}"
autosize(ws, [13, 26, 30, 9, 12, 11, 20, 15, 15, 15, 15, 15, 20, 16])
ws.column_dimensions["A"].width = 13

# ------------------------------------------------------------ All Conditions
ws = wb.create_sheet("All Conditions")
hdr = ["Brand", "Series", "Model", "RAM (GB)", "Storage (GB)", "Variant ID",
       "Condition group", "Condition (answer that triggers the deduction)",
       "Flawless price (₹)", "Deduction (₹)", "Price with this condition (₹)",
       "Drop vs flawless"]
for c, h in enumerate(hdr, start=1):
    ws.cell(row=1, column=c, value=h)
style_header(ws)

row = 2
for d in devices:
    for group, key, label in CONDITIONS:
        p = price(d, [key])
        vals = [d["brand"], d["series"], d["model"], d["ram"], d["rom"],
                d["variant_id"], group, label, round(d["msp"]),
                round(d["ded"].get(key, 0)), round(p),
                round(d["ded"].get(key, 0) / d["msp"], 3) if d["msp"] else 0]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=row, column=c, value=v)
            if c in (9, 10, 11):
                cell.number_format = INR
            if c == 12:
                cell.number_format = PCT
        row += 1

last = row - 1
band(ws, 2, last, len(hdr))
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(hdr))}{last}"
autosize(ws, [13, 24, 28, 9, 11, 11, 15, 44, 16, 13, 24, 13])

# ------------------------------------------------------ Condition Deductions
ws = wb.create_sheet("Condition Deductions")
hdr = ["Brand", "Series", "Model", "RAM (GB)", "Storage (GB)", "Variant ID",
       "Flawless price (₹)"]
for _, _, label in CONDITIONS:
    hdr.append(f"{label} – ₹")
for _, _, label in CONDITIONS:
    hdr.append(f"{label} – %")
for c, h in enumerate(hdr, start=1):
    ws.cell(row=1, column=c, value=h)
style_header(ws, height=60)

for i, d in enumerate(devices, start=2):
    vals = [d["brand"], d["series"], d["model"], d["ram"], d["rom"],
            d["variant_id"], round(d["msp"])]
    vals += [round(d["ded"].get(k, 0), 1) for _, k, _ in CONDITIONS]
    vals += [round(d["ded"].get(k, 0) / d["msp"], 4) if d["msp"] else 0
             for _, k, _ in CONDITIONS]
    for c, v in enumerate(vals, start=1):
        cell = ws.cell(row=i, column=c, value=v)
        if 8 <= c <= 7 + len(CONDITIONS):
            cell.number_format = INR
        if c > 7 + len(CONDITIONS):
            cell.number_format = '0.0%'
    # colour scale across the deduction columns
n = len(devices) + 1
if n > 2:
    ws.conditional_formatting.add(
        f"H2:{get_column_letter(7 + len(CONDITIONS))}{n}",
        ColorScaleRule(start_type="min", start_color="FFFFFF",
                       end_type="max", end_color="F8696B"))
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(hdr))}{n}"
autosize(ws, [12, 22, 26, 8, 10, 10, 15] + [13] * len(CONDITIONS)
         + [9] * len(CONDITIONS))

# ------------------------------------------------------------- Brand Summary
ws = wb.create_sheet("Brand Summary")
hdr = ["Brand", "Variants", "Models", "Flawless: min (₹)", "Flawless: max (₹)",
       "Flawless: average (₹)", "Average 'Good' price (₹)",
       "Average 'Fair' price (₹)"]
for c, h in enumerate(hdr, start=1):
    ws.cell(row=1, column=c, value=h)
style_header(ws)

by_brand = {}
for d in devices:
    by_brand.setdefault(d["brand"], []).append(d)

i = 2
for b in sorted(by_brand, key=str.upper):
    ds = by_brand[b]
    good = [price(d, GRADES[2][2]) for d in ds]
    fair = [price(d, GRADES[3][2]) for d in ds]
    vals = [b, len(ds), len({d["model"] for d in ds}),
            round(min(d["msp"] for d in ds)), round(max(d["msp"] for d in ds)),
            round(statistics.mean(d["msp"] for d in ds)),
            round(statistics.mean(good)), round(statistics.mean(fair))]
    for c, v in enumerate(vals, start=1):
        cell = ws.cell(row=i, column=c, value=v)
        if c >= 4:
            cell.number_format = INR
        cell.border = BORDER
    i += 1

tot = ["TOTAL", len(devices), len({(d['model']) for d in devices}),
       round(min(d["msp"] for d in devices)), round(max(d["msp"] for d in devices)),
       round(statistics.mean(d["msp"] for d in devices)),
       round(statistics.mean(price(d, GRADES[2][2]) for d in devices)),
       round(statistics.mean(price(d, GRADES[3][2]) for d in devices))]
for c, v in enumerate(tot, start=1):
    cell = ws.cell(row=i, column=c, value=v)
    cell.font = Font(bold=True)
    if c >= 4:
        cell.number_format = INR
i += 1
band(ws, 2, i - 1, len(hdr))
ws.freeze_panes = "B2"
autosize(ws, [18, 10, 9, 16, 16, 18, 22, 20])

# ---------------------------------------------------------------------- Data
ws = wb.create_sheet("Data")
fields = ["Brand", "Series", "Model", "RAM (GB)", "Storage (GB)", "Variant ID",
          "Flawless price (MSP)"] + [lab for _, _, lab in CONDITIONS] + \
         ["Last updated (site)"]
for c, h in enumerate(fields, start=1):
    ws.cell(row=1, column=c, value=h)
style_header(ws, height=45)

for i, d in enumerate(devices, start=2):
    vals = [d["brand"], d["series"], d["model"], d["ram"], d["rom"],
            d["variant_id"], d["msp"]]
    vals += [d["ded"].get(k, 0) for _, k, _ in CONDITIONS]
    vals.append(str(d["updated"] or ""))
    for c, v in enumerate(vals, start=1):
        ws.cell(row=i, column=c, value=v)
n = len(devices) + 1
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(fields))}{n}"
autosize(ws, [12, 22, 26, 8, 10, 10, 16] + [11] * len(CONDITIONS) + [20])

wb.save(OUT)
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")
