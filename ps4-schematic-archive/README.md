# PS4 power-supply schematic archive

Everything that is inside the Scribd document you linked
([scribd.com/document/689240918](https://www.scribd.com/document/689240918/Ps4-Adp-160cr-Psu-schematic)),
pulled out as full-size images, plus a cleaned-up, indexed set for reading.

> **Start here:** [`index.html`](index.html) — a visual gallery of every image in this folder,
> with the schematic sheets first, then zoom crops, then the block diagram.

---

## 1. What that Scribd page actually contains

| | |
|---|---|
| Title on Scribd | *Ps4 Adp-160cr Psu Schematic* |
| Document ID | 689240918 |
| Uploader | Laptop Baling Resources |
| Length | **2 pages** |
| Stats | ~6 000 views, 100 % (4 votes) |
| Real content | The 2-sheet service schematic **"SONY PS4 ORIGINAL POWER UNIT ADP-160CR"** |

### Sheet 1 — `STAND BY & PROTECTION CIRCUIT`
AC inlet + fuse + bridge, the bleed/divider stack, the **IC101 DAP041 (= NCP1246)** standby
flyback controller, **Q9 3N90K** switch, **T1** standby transformer, secondary rectifier and
**+4.8 V SB** output filter (**C120 680 µF/16 V**) into **CN1213 (GND) / CN1214 (+4.8 V SB)**,
the opto feedback pair, the **Q41 2SD1803** bias regulator, the protection supervisor, and the
**CN1211 `ACIN_DET` / CN1212 `ACDC_STBY`** test pads.

### Sheet 2 — `PFC & SMPS CIRCUIT`
AC inlet (F1 4 A) → **BD1 GBU406** bridge → **NTC01 5D-11** + **L1** EMI choke → the PFC boost
stage (**Q1 24N60**, boost diode, **C114** bulk → **+380 V**, annotated *"TO STBY CCT"*) controlled
by **IC41 NCP1612A1**, then the LLC half-bridge (**Q3/Q4 6R099P**, **L2** + **C19/C15** tank,
**T2**) driven by **IC32 DDA001AG (= NCP1396A)**, then the **Q101/Q102 88N06** synchronous
rectifiers steered by **IC104 MP6922L**, the **+12 V** output bank (**C116/C118/C122**, **R112 0R05**)
and the **IC103 CNY17A** feedback opto.

**Who drew it:** the sheets carry the watermark `randeefigumasekara@yahoo.com  03/02/2022`.
This is a hand-traced reverse-engineering redraw, **not** an official Sony/Delta release, which
is why a few designators (C18/C19, R39, Q4 on the sister ADP-160ER board) are debated on repair
forums.

**Same file, other mirrors** — useful if Scribd starts paywalling:

* `SONY PLAY STATION PS4 ADP-160CR PSU POWER SUPPLY SCH` — 523.4 KB / 2 pages on
  [elektrotanya.com](https://elektrotanya.com/sony_play_station_ps4_adp-160cr_psu_power_supply_sch.pdf/download.html)
* the same 523.36 KB PDF on
  [electronica-pt.com](https://www.electronica-pt.com/esquema/fontes/sony-ps4-slim-adp160-87656/)
* the same file is what people attach on badcaps / DigiKey forums as
  `sony_play_station_ps4_adp-160cr_psu_power_supply_sch.pdf` (523.4 KB)

> Scribd serves the pages as JS-gated, token-signed images, so this archive works from the
> identical public mirror of the PDF rather than from scribdassets.com directly.

---

## 2. Image index

All files live in `images/adp-160cr/`.

### 2.1 The two original sheets (readable versions)

| File | What it is |
|---|---|
| `01-standby-and-protection-circuit-annotated.png` | Sheet 1 with 15 numbered regions + legend |
| `02-pfc-and-smps-circuit-annotated.png` | Sheet 2 with 15 numbered regions + legend |
| `01-standby-and-protection-circuit-3x-enhanced.png` | Sheet 1, 3× Lanczos upscale + unsharp mask — best for reading |
| `02-pfc-and-smps-circuit-3x-enhanced.png` | Sheet 2, same treatment |
| `01-standby-and-protection-circuit-original.png` | Sheet 1, untouched 1052 × 744 source |
| `02-pfc-and-smps-circuit-original.png` | Sheet 2, untouched source |

### 2.2 Zoom crops (25 % of a sheet, 5–8× upscale)

Sheet 1 — `crops/01-page1-*.png`

| # | File | Region |
|---|---|---|
| 01 | `01-page1-01-ac-inlet-fuse-bridge` | IEC C7, F1 4 A, D41/D42, R9/R4 |
| 02 | `01-page1-02-ic101-dap041-ncp1246` | IC101 NCP1246 standby controller + pinout |
| 03 | `01-page1-03-startup-resistors-snubber` | R40 330 K / R37 561 K, R13/R14, D1, C15 |
| 04 | `01-page1-04-q9-3n90k-standby-switch` | Q9, R52/R56, ZD09, R53/R54 |
| 05 | `01-page1-05-t1-standby-transformer` | T1 windings |
| 06 | `01-page1-06-4v8-output-filter-connectors` | D101, C102/C103, L101, C120, CN1213/CN1214 |
| 07 | `01-page1-07-optofeedback-ad-det` | IC102/IC103 optos, ZD002, C43 |
| 08 | `01-page1-08-q41-bias-regulator` | Q41 2SD1803, R141/R44, ZD37 |
| 09 | `01-page1-09-testpads-acin-acdc` | CN1211 ACIN_DET, CN1212 ACDC_STBY |
| 10 | `01-page1-10-12v-sense-divider` | R165/R180/R189, NTC101, ZD104 |

Sheet 2 — `crops/02-page2-*.png`

| # | File | Region |
|---|---|---|
| 01 | `02-page2-01-ac-inlet-emi-filter` | F1, BD1 GBU406, CX5, NTC01 5D-11, L1 |
| 02 | `02-page2-02-ic41-ncp1612a1` | IC41 PFC controller + pinout |
| 03 | `02-page2-03-pfc-buffer-and-bulk` | Q1/Q2 buffer, ZD101/ZD102, C114 |
| 04 | `02-page2-04-llc-halfbridge-q3-q4` | Q3/Q4 6R099P, C19/C15, L2, D4 |
| 05 | `02-page2-05-t2-and-sync-rectifiers` | T2, Q101/Q102, D5, C10 |
| 06 | `02-page2-06-ic104-mp6922` | IC104 MP6922L SR controller |
| 07 | `02-page2-07-output-filter-connectors` | C116/C118/C122, R112, CN1213/CN1214 |
| 08 | `02-page2-08-ic32-ncp1396-llc-ctrl` | IC32 DDA001AG (= NCP1396A) |
| 09 | `02-page2-09-vcc-from-standby` | *"FROM STBY CCT +19 V"*, ZD21, C35 |
| 10 | `02-page2-10-feedback-opto-12v` | IC103 CNY17A, R191/R193/C141, ZD7A |

### 2.3 Diagrams & notes (`docs/`)

| File | What it is |
|---|---|
| `docs/ADP-160CR-block-diagram.png` | Power-flow block diagram I redrew (AC → PFC → LLC → SR → 12 V, plus the standby chain and the feedback layer) |
| `docs/ADP-160CR-component-reference.md` | Every designator transcribed, with a confidence grade and the Delta→onsemi part mapping |
| `docs/PS4-PSU-model-matrix.md` | All PS4 power-supply models, what console they belong to, what documentation exists |

---

## 3. The one thing worth knowing before you use this

The ADP-160CR uses **Delta house numbers instead of real part numbers**. If you are trying to
buy a replacement, this is the mapping:

| Silkscreen | Actual chip |
|---|---|
| `DAP041` | **NCP1246** (standby flyback) |
| `DDA001AG` | **NCP1396A/B** (LLC) |
| `1812A1` / `ODEZ` | **NCP1612A1** (PFC) |
| `MP6922L` | **MP6922** (sync rectifier) |
| `CNY17A` | CNY17 opto |

Repair shops routinely fail to find "DAP041" in a parts search — search for NCP1246 instead.

---

## 4. Safety

* The **primary side is mains-live**. C114 (bulk) and C19/C15 hold **>380 V** for minutes after
  unplug. Discharge them through a resistor and verify with a meter **before** touching anything.
* Never connect a scope or meter ground to the primary side unless you are using an isolation
  transformer and a differential probe. A grounded scope clip on the primary is a dead short.
* The secondary (+12 V / +4.8 V) is SELV and safe to probe normally.
* Do not run the supply on the bench with the board floating and the heatsinks unbolted — the
  MOSFETs use the case as a thermal path and will die in seconds.

---

## 5. Scope / provenance

* Schematics: the 2-page ADP-160CR PDF above — drawn by a third party in 2022, distributed
  freely on repair sites. Reproduced here for repair reference.
* Model specs: [psdevwiki.com/ps4](https://www.psdevwiki.com/ps4/Power_Supply) and the
  elektrotanya / electronica-pt mirrors.
* Parts list cross-check: the EletrônicaBR "Electrical Schematics and Datasheets – PS4 Power
  Supplies" package listing (ADP-160CR, ADP-300CR AA, ADP-160ER AAA).
* This archive is **not** affiliated with Sony Interactive Entertainment, Delta Electronics or
  Chicony. No warranty — verify every value against your own board.
