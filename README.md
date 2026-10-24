# GoExtraCash — condition-wise price list

Scraped price data from [goextracash.com](https://www.goextracash.com/) (India),
turned into one Excel workbook where every phone model × storage variant has a
price for each device condition.

**Deliverable:** `output/GoExtraCash_Condition_Wise_Price_List.xlsx`

| Sheet | What's in it |
| --- | --- |
| **Read Me** | Source, method, and how the prices are calculated |
| **Price by Condition** | One row per variant: flawless price plus the price if each single condition applies (24 real conditions from the site's flow) |
| **All Conditions** | Long format (≈90k rows): one row per variant × condition, with the deduction and the resulting price — best for pivots |
| **Condition Deductions** | The site's raw deduction table per variant, in ₹ and % of the flawless price |
| **Brand Summary** | Variant counts and price ranges per brand |
| **Data** | Flat export of every field returned by the price API |

Coverage: **2,309 RAM/ROM variants across 22 brands / 23 brand labels**.

## How the pricing works

Every variant has a *flawless price* (the site calls it MSP) — what you get for a
phone with no defects, all accessories, bill and warranty. Each condition defect
carries a fixed deduction, and

```
quote = flawless price − Σ (deductions for the defects you declare)
```

This was verified against the site's own quote endpoint: single defects,
random multi-defect combinations and devices across brands all matched exactly
(36/36 random checks). Combinations whose deductions exceed the flawless price
are quoted specially by the site and are floored at ₹0 in the workbook.

## Refreshing the data

```bash
python3 scripts/gxc_crawl.py      # writes data/catalog.json + data/devices_full.json
python3 scripts/build_excel.py    # writes output/*.xlsx
```

`gxc_crawl.py` needs open internet access to `api.goextracash.com`
(≈5k requests, roughly 20 minutes with 6 workers). `build_excel.py` needs
`openpyxl`.

## Data source

* Site: https://www.goextracash.com/
* Price API: `https://api.goextracash.com/`
  (`/brands`, `/series/{brand}`, `/devices/{series}`, `/variants/{model}`,
  `/device/{variant_id}`, `POST /checkout` for quotes)
* Prices are indicative quotes made before physical inspection — the site
  states the final price may change after evaluation.
