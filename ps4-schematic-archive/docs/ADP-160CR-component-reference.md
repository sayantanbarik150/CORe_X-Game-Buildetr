# ADP-160CR — component reference

Transcribed by zooming into the two schematic sheets at 5×–14× and reading the
silkscreen legends. The source scan is a low-resolution redraw, so treat every
value below as **"legible on the scan", not "guaranteed"** — a few designators
are ambiguous and are marked with `?`.

Confidence key: **A** = unambiguous, **B** = readable but could be a lookalike
(e.g. `8`/`B`, `0`/`D`), **C** = best guess from context.

---

## 1. Identity

| Item | Value | Conf. |
|---|---|---|
| Sony part family | ADP-160CR / ADP-160CR AAD | A |
| Delta / Chicony model | N15-160P1A | A |
| Consoles | PS4 Slim — CUH-20xx, CUH-21xx, CUH-22xx | A |
| AC input | 100–240 V~, 2.5 A, 50/60 Hz | A |
| DC output | +12 V / 13 A and +4.8 V / 1.5 A (≈163 W) | A |
| Output connector | 4-pin (2 heavy +12 V/GND blades + 2 signal pins) | A |
| Topology | PFC boost + LLC half-bridge with synchronous rectification + separate flyback standby | A |

The schematic itself is titled **"SONY PS4 ORIGINAL POWER UNIT ADP-160CR"** and is split
into two sheets:

* Sheet 1 — `STAND BY & PROTECTION CIRCUIT`
* Sheet 2 — `PFC & SMPS CIRCUIT`

Watermark on the drawing: `randeefigumasekara@yahoo.com  03/02/2022` — the reverse engineer
who drew it.

---

## 2. Controllers and ICs

The ADP-160CR uses **Delta-branded house numbers**, not the original vendor part numbers.
The mapping below is the useful bit for repair.

| Ref | Marking on part | Real device | Function | Conf. |
|---|---|---|---|---|
| IC101 | `DAP041` | **NCP1246** (onsemi) | Standby flyback current-mode PWM controller | A |
| IC32 | `DDA001AG` | **NCP1396A/B** (onsemi) | LLC resonant half-bridge controller | A |
| IC41 | `1812A1` / `ODEZ` | **NCP1612A1** (onsemi) | Transition-mode PFC controller | B |
| IC104 | `MP6922L` | **MP6922** (MPS) | Dual-channel synchronous-rectifier controller | A |
| IC103 | `CNY17A` | CNY17-x opto | Main 12 V feedback opto-coupler | A |
| IC102 / IC105 / IC106 | `I00A W` etc. | opto-couplers | Secondary feedback / enable / protection | B |
| Q31 | `W3N-2MZDK` | small-signal MOSFET | Protection supervisor switch | C |
| Q41 | `2SD1803` | 2SD1803 | VDD / +18 V bias regulator pass device | B |
| Q1 / Q2 (page 2) | `M0620` | small MOSFET | PFC gate drive buffer pair | B |
| Q9 | `3N90K` | 900 V-class MOSFET | Standby primary switch | B |
| Q1 (page 2 header) | `24N60` (`24N60M2`) | ST 24N60M2 | **PFC boost switch** | B |
| Q3 / Q4 | `6R099P` | 600 V superjunction | LLC half-bridge pair | B |
| Q101 / Q102 | `88N06` | 60 V N-channel | Synchronous rectifiers | B |

> Note: `Q1` appears twice on the drawing (once in the PFC stage, once in the drive
> buffer) — the re-drawn sheet is not perfectly de-duplicated. On the real board the
> PFC switch is the big TO-247/TO-220 device on its own heatsink.

---

## 3. Sheet 1 — standby & protection

| Ref | Value / type | Where it sits | Conf. |
|---|---|---|---|
| F1 | 4 A fuse | AC inlet line | A |
| D41 / D42 | `6HW`? bridge halves | AC inlet rectifier | B |
| R9 / R4 | `2741` / `2741` | inlet inrush / discharge | C |
| CX5, CX7, CX8 | 680 n / 400 V X-cap, X2 class | EMI filter | A |
| CY-series caps | Y-cap, 680 p / 1 kV ×2 | across the isolation barrier | B |
| R16, R17, R18 | `3004`, `3004`, `614` | high-value bleed / divider stack | A |
| C36 | 100 µF / 25 V | standby bulk | A |
| R40 / R37 | 330 K / 561 K | startup resistor pair into IC101 | A |
| C15 | — | primary snubber cap | A |
| R13, R14 | `184` (180 k?) | snubber / discharge resistors | B |
| D1 | `51H`? | snubber diode across T1 primary | B |
| D2 | — | clamp diode | B |
| R52 / R56 | `101` / `R10-100K` | Q9 gate network | B |
| ZD09 | — | gate protection zener | B |
| R53 / R54 | `2F00` / `2F00` | current-sense / source resistors | C |
| ZD01 | `51M`? | clamp | C |
| T1 | standby flyback transformer, pins 5-7 / 8-9 → 4-1 | isolation for the 4.8 V rail | A |
| D101 | `SX230`? | secondary rectifier | C |
| C102 / C103 | — | rectifier snubber | B |
| C110 / C112 | 680 p / 1 kV ×2 | snubber | B |
| R111 | `R1005` (1 Ω?) | output series / fuse resistor | B |
| L101 | choke | 4.8 V SB output filter | A |
| C120 | **680 µF / 16 V** | 4.8 V SB bulk | A |
| C121 | — | 4.8 V SB ceramic | A |
| CN1213 / CN1214 | test pads / vias | **CN1214 = +4.8 V SB**, **CN1213 = GND** | A |
| IC102 | opto | standby regulation feedback | B |
| IC103 / IC105 | opto | secondary-side signalling | B |
| ZD002 | `3V`? | reference clamp | C |
| C43 | — | reference bypass | B |
| Q41 | 2SD1803 | VDD / +18 V linear regulator | B |
| R141 / R44 | `613` / `182` | Q41 bias divider | B |
| C46 / C50 / C51 | — | bias rail caps | C |
| ZD37 | `20-6V1` | 20 V / 6.1 V zener string | B |
| R141 / R173 / R175 / R177 / R179 | `613` / `5ID-10K` / `101` / `101` | supervisor dividers | C |
| CN1211 | test pad | **`ACIN_DET`** | A |
| CN1212 | test pad | **`ACDC_STBY`** | A |
| R152 / R154 / R173 | 910 K / 725 K / 5ID-10K | ACDC_STBY divider | B |
| R165 / R180 / R189 | `3901` / `390` / `156-SDR` | 12 V OUT sense divider | B |
| NTC101 | thermistor | output temperature sense | A |
| ZD104 | `26-24V`? | 12 V rail clamp | B |
| R186 / R191 | `390` / `162` | signal conditioning | B |

---

## 4. Sheet 2 — PFC & SMPS

| Ref | Value / type | Where it sits | Conf. |
|---|---|---|---|
| F1 | 4 A | AC inlet | A |
| BD1 | **GBU406** | bridge rectifier | A |
| CX5 | 680 n / 400 V | X-cap | A |
| NTC01 | **5D-11** | inrush current limiter | A |
| L1 (input) | EMI choke | common-mode filter | A |
| CX7, CX8, C70, C72 | X2 caps | EMI filter | A |
| D11 | `THV-L0G08`? | PFC input diode | C |
| C1 / C2 / C3 | `683` (68 n) | PFC input filter | B |
| R35 | **250 K** | PFC input sense divider | A |
| R1 | `0R16` | current sense shunt (PFC) | A |
| Q1 (PFC) | 24N60 | PFC boost switch | B |
| D3 | `SX230`? | PFC boost diode | C |
| R46 | `10R` | PFC gate resistor | A |
| ZD101 / ZD102 | `26-24V` | gate clamp | B |
| C114 | — | PFC bulk / hold-up cap | A |
| Q1 / Q2 buffer | `M0620` | PFC gate drive buffer | B |
| R61 | `5ID-10CK` | buffer bias | C |
| Q3 / Q4 | `6R099P` | LLC half-bridge | B |
| C19, C15 | — | LLC coupling caps | A |
| L2 | resonant inductor | LLC tank | A |
| D4 | `ES3008`? | bootstrap / clamp | C |
| R48 / R49 / R55 / R56 | `R10-100K`? / `R10-100K`? | LLC timing / sense network | C |
| R58 / R74 / R58 | `5ID-10CK` / `382` | divider networks | C |
| T2 | main transformer — primary 5-7-8-9, secondary 4-1 | LLC power transformer | A |
| D5 | `M5660`? | secondary clamp | C |
| C10 | `472/3KV` | Y-cap across the barrier | A |
| IC104 | MP6922L | dual SR controller | A |
| R155 / R59 | `101` | SR gate resistors | B |
| R145 / R143 | `2R2` / `2R2` | SR gate resistors | B |
| Q101 / Q102 | `88N06` | synchronous rectifiers | B |
| C116, C118, C122 | `2700uF/16V`? ×2, 470 uF/16 V | +12 V output bank | B |
| R112 | `0R05` | output current shunt | A |
| R186 / R189 / R203 | `390`, `150`? | feedback dividers | C |
| D7 | `SX230`? | feedback rectifier | C |
| IC103 | CNY17A | feedback opto | A |
| ZD7A / ZD104 | `18V` / `26-24V` | clamps | B |
| R191 / R193 / R186 | `162` / `1R`? / `390` | opto biasing | C |
| C141 | — | opto compensation | B |
| IC32 | `DDA001AG` | LLC controller | A |
| R63 / R80 / R58 | `2E15-1K?` / `2B5-6R2` | timing | C |
| C73 | — | timing cap | B |
| R76 / R75 / R10 | `543` / `333` / `312` | dividers | C |
| R77 | `R10-100K`? | divider | C |
| C74 / C76 | — | timing caps | B |
| ZD21 | `15-18V` | VCC clamp | B |
| C35 | — | VCC bulk | B |
| NTC41 | `12K` | inrush / temperature | B |
| R70 | `390` | sense | C |
| J52 | `0R` | link | B |

**Net names / annotations on the drawing**

* `+380V` — PFC bulk rail, annotated **"TO STBY CCT"** at the top of sheet 2
* **"FROM STBY CCT +19V/5W"** — the VCC feed that comes back from sheet 1
* `PFC-VDD`, `+18V/50W`, `+5V`, `+4V`, `+12V OUT`, `12V_CNT`
* `ACIN_DET`, `ACDC_STBY` — the two diagnostic/sense nets taken to test pads
* Test pad numbers in the drawing's table: `IC804`, `IC824`, `IC834`, `CN1211`, `CN1212`,
  `CN1213`, `CN1214`, `CN1218`, `CN1220`, `CN1221`, `CN1222`, `CN1227`, `CN1230`,
  `CN1231`, `CN1241`

---

## 5. How the supply sequences

1. **Mains present** → EMI filter → bridge → doubler/rectifier rail (~190 V) →
   standby stage runs immediately and produces **+4.8 V SB** on CN1214.
2. The +4.8 V rail powers the console's always-on logic. Press power → the console
   pulls its `PS-ON`-style signal, which enables the main converter through the
   secondary-side opto path (IC102/IC103/IC105/IC106 chain).
3. **PFC (IC41 / NCP1612A1)** boosts the ~190 V rectified rail to **+380 V**, drawing a
   sinusoidal input current (power-factor corrected, EN 61000-3-2 compliant).
4. **LLC (IC32 / NCP1396A)** drives Q3/Q4 into T2. Secondary is rectified by
   Q101/Q102 synchronous rectifiers steered by **IC104 / MP6922L**.
5. **+12 V** appears on CN1214 / CN1213. Feedback goes back through **IC103 (CNY17A)**.
6. Any of: over-voltage, over-current, over-temperature (NTC101), loss of `ACIN_DET`,
   or a failed PFC rail → the supervisor pulls the enable line and the supply latches off.
   That is the classic "PS4 Slim shuts down after 2 seconds / blinks then dead" symptom.

---

## 6. Common failure points (from repair threads, not from the drawing)

| Symptom | Usual culprit |
|---|---|
| Dead, no +4.8 V SB at all | F1 fuse, NTC01 5D-11, D41/D42, IC101 DAP041, R40/R37 startup resistors, Q9 |
| +4.8 V SB present, console won't turn on | PFC stage: Q1 24N60, D3, R1 0R16 shunt, IC41 NCP1612A1, C114 |
| Starts then shuts down after ~2 s | LLC: Q3/Q4 6R099P, IC32 DDA001AG, C19/C15, feedback opto IC103 |
| 12 V low / unstable under load | output caps C116/C118/C122, R112 0R05, SR MOSFETs Q101/Q102, IC104 |
| Blown MOSFETs around C18/C19 (ADP-160ER) | known weak spot — replace both FETs and the two caps together |

Always check the **code printed on the board** (ADP-160CR vs ADP-160ER vs ADP-160FR) before
ordering parts — Sony used different revisions on visually identical boards.
