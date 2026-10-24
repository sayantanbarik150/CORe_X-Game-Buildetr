"""Split the master workbook into one file per sheet (XLSX + CSV).

Output: output/sheets/<Sheet name>.xlsx  and  <Sheet name>.csv
"""
import csv
import os
import shutil

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "output", "GoExtraCash_Condition_Wise_Price_List.xlsx")
OUTDIR = os.path.join(ROOT, "output", "sheets")
os.makedirs(OUTDIR, exist_ok=True)

names = load_workbook(MASTER, read_only=True).sheetnames
print("sheets:", names)


def slug(n):
    return n.replace(" ", "_")


# ---- one XLSX per sheet (styling, filters and number formats kept)
for name in names:
    wb = load_workbook(MASTER)
    for other in list(wb.sheetnames):
        if other != name:
            del wb[other]
    path = os.path.join(OUTDIR, f"GoExtraCash_{slug(name)}.xlsx")
    wb.save(path)
    print(f"  xlsx {os.path.basename(path):45s} {os.path.getsize(path) / 1024:8.0f} KB")
    del wb

# ---- one CSV per sheet (UTF-8 with BOM so Excel shows ₹ correctly)
for name in names:
    wb = load_workbook(MASTER, read_only=True)
    ws = wb[name]
    path = os.path.join(OUTDIR, f"GoExtraCash_{slug(name)}.csv")
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        padded = []
        for row in ws.iter_rows(values_only=True):
            cells = ["" if v is None else v for v in row]
            # keep short rows filled so spreadsheet columns line up
            if cells and len(padded) and len(cells) < len(padded[-1]):
                cells += [""] * (len(padded[-1]) - len(cells))
            w.writerow(cells)
            padded.append(cells)
    print(f"  csv  {os.path.basename(path):45s} {os.path.getsize(path) / 1024:8.0f} KB")
    del wb

# ---- single zip with everything
zip_base = os.path.join(ROOT, "output", "GoExtraCash_Sheets")
shutil.make_archive(zip_base, "zip", OUTDIR)
print("zip:", zip_base + ".zip",
      f"{os.path.getsize(zip_base + '.zip') / 1024 / 1024:.1f} MB")
