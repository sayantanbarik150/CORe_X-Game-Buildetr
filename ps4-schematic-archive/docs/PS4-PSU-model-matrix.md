# PS4 power-supply model matrix

The PS4 shipped with at least **ten** different internal PSUs across Fat / Slim / Pro and the
two hardware revisions of each. This is the map of which is which, so you do not chase the
wrong schematic.

| Model | Also branded | Console | AC input | DC output | Pins | Schematic available? |
|---|---|---|---|---|---|---|
| **ADP-160CR** | N15-160P1A (Delta / Chicony) | **PS4 Slim** CUH-20xx / 21xx / 22xx | 100–240 V, 2.5 A, 50/60 Hz | +12 V 13 A, +4.8 V 1.5 A (≈163 W) | 4 | ✅ **This archive — 2 sheets, full** |
| **ADP-160ER** | N16-160P1A | PS4 Slim CUH-21xx | 100–240 V | +12 V, +4.8 V | 4 | ⚠️ Partial — shares most of the ADP-160CR drawing; its own sheet set exists in the EletrônicaBR package ("ADP-160ER AAA") |
| **ADP-160FR** | — | PS4 Slim CUH-22xx | 100–240 V | +12 V, +4.8 V | 4 | ❌ Not found publicly |
| **ADP-200ER** | — | PS4 Slim (region variant) | 100–240 V | +12 V | 4 | ❌ Not found publicly |
| **ADP-240AR** | 1-474-542-11 | **PS4 Fat** CUH-10xx, DUH-T1000AA | 100–240 V, 2.5 A | +12 V 17 A (18.6 A 12 V-only) + +4.7 V 3 A | **5** | ⚠️ Partial — board photos + annotated component map on psdevwiki; no full drawing |
| **ADP-240CR** | N14-240P1A | PS4 Fat CUH-11xx / 12xx | 100–240 V | +12 V, +4.7 V | 5 | ❌ Not found publicly |
| **ADP-300CR** | N15-300P1A | **PS4 Pro** CUH-70xx | 100–240 V, 3.5 A | +12 V **23.5 A**, +4.8 V 1.5 A | 5 | ⚠️ Partial — pinout photo + "ADP-300CR AA" sheet set in the EletrônicaBR package |
| **ADP-300ER** | N15-300P1A | PS4 Pro CUH-71xx | 100–240 V | +12 V 23.5 A | 5 | ❌ Not found publicly |
| **ADP-300FR** | — | PS4 Pro CUH-72xx | 100–240 V | +12 V 23.5 A | 5 | ❌ Not found publicly |
| **ADP-344AR** | — | **HAC-001** (devkit / special HW) | 100–240 V, 4.3–1.6 A | +12 V **27.5 A**, +4.7 V 3 A | 5 | ❌ Not found publicly |

Specs cross-checked against [psdevwiki.com/ps4/Power_Supply](https://www.psdevwiki.com/ps4/Power_Supply)
and the individual model pages.

---

## Reading the model code

```
ADP - 160 CR
 │     │   └── region / vendor revision:  AR, CR, ER, FR …
 │     └────── nominal wattage (160 W, 240 W, 300 W, 344 W)
 └──────────── Delta "ADP" platform
```

* `*R` suffix + letter = Delta revision for a specific market. **AR** = first-gen, **CR** = 2nd,
  **ER/FR** = later Slim revisions.
* `N15-…P1A` / `N16-…P1A` is the same unit under Delta/Chicony's own part number.
* **The suffix matters.** ADP-160CR and ADP-160ER look identical from outside but differ in the
  PFC section and the C18/C19 snubber parts — a known ADP-160ER failure spot.

---

## Which consoles use which

| Console | PSU |
|---|---|
| PS4 Fat CUH-10xx | ADP-240AR |
| PS4 Fat CUH-11xx / 12xx | ADP-240CR / N14-240P1A |
| PS4 Slim CUH-20xx | ADP-160CR / N15-160P1A |
| PS4 Slim CUH-21xx | ADP-160ER / N16-160P1A |
| PS4 Slim CUH-22xx | ADP-160FR |
| PS4 Pro CUH-70xx | ADP-300CR / N15-300P1A |
| PS4 Pro CUH-71xx | ADP-300ER |
| PS4 Pro CUH-72xx | ADP-300FR |

Slim and Pro supplies are **not interchangeable** — different pin count, different connector
keying, and the Pro needs 23.5 A on the 12 V rail against the Slim's 13 A.

---

## Where else to look

| Source | What it has | Access |
|---|---|---|
| [elektrotanya](https://elektrotanya.com/sony_play_station_ps4_adp-160cr_psu_power_supply_sch.pdf/download.html) | The exact 2-page ADP-160CR PDF (523.4 KB) | Free, no login |
| [electronica-pt](https://www.electronica-pt.com/esquema/fontes/sony-ps4-slim-adp160-87656/) | Same PDF, mirror | Free, no login |
| [eletronicabr.com file 44400](https://eletronicabr.com/en/files/file/44400-electrical-schematics-and-datasheets-playstation-4-ps4-power-supplies-schematic/) | ADP-160CR + ADP-300CR AA + ADP-160ER AAA sheets **plus datasheets** for NCP1246, NCP1396A/B, NCP1612, HR1000A, MP6922, DNP015, MRD6432, STB33N65M2, STD80N6F6, IPA60R190E6, FERD15S50SB, PBSS4240T, 2N7002K, CJ2301 | Requires a (free) account, credit system |
| [psdevwiki PS4 Power Supply](https://www.psdevwiki.com/ps4/Power_Supply) | Model list, specs, board photos, ADP-240AR annotated component map, ADP-300CR pinout | Free |
| badcaps.net PSU subforum | Real repair threads per model, known-failure parts | Free |

If you need the **ADP-240AR** (Fat) or **ADP-300CR** (Pro) schematics specifically, the
EletrônicaBR package is currently the only place that has them in one file — the free mirrors
only carry ADP-160CR.
