# Mockup System V2 — Visual QA Checklist

A short, human-executable checklist for confirming mockup placement looks right in a real browser. Not a UAT suite — just the mockup visuals. Run this after any geometry or asset change to the priority garments.

**How to run it**: open the New/Edit Order form, add a print location, and step through each row below, switching garment type/position/colour as needed. For each row, record **PASS**, **ADJUST** (looks close but needs a coordinate tweak in `src/config/garmentGeometry.ts`), or **FAIL** (materially wrong — e.g. off the garment, wrong view, or crashed).

As of Batch C, this checklist has **not been run** — no browser tooling has been available to any session that worked on Mockup System V2 so far. Every placement value has been calibrated by direct visual inspection of the source garment photos and verified with pure geometry math (unit tests), but never confirmed in an actual rendered `<canvas>`/`<img>`. Run this before treating placement as production-confirmed.

## Human QA finding (post-Batch-C)

First round of real human visual QA reported: **"Overall tracking/alignment greatly improved. Upper-body Left Chest, Right Chest, Across Chest and Top Back positions required additional neckline/collar clearance."** — deterministic positioning, artwork-follows-position, and general garment geometry were all confirmed working; only vertical breathing room below the neck/collar on these four positions needed adjustment.

A geometry patch (`src/config/garmentGeometry.ts`) applied a small, garment-specific downward shift to Left Chest, Right Chest, Across Chest, and Top Back for T-shirt, Hoody, Polo, and Crew neck — see `docs/MOCKUP_V2_NECK_CLEARANCE_PATCH.md` for the exact before/after values. **These four positions are marked RETEST REQUIRED below, not PASS** — only a human visual re-check can confirm the patch actually fixed the issue.

## What to check on every row

- Anatomically correct location for the position name
- Not touching/overlapping the neckline or collar
- Not touching/overlapping the hem
- Sleeve print sits within the printable sleeve region, not on the shoulder seam or off the sleeve edge
- Reasonably centered for the position (not obviously skewed left/right or up/down)
- Print size looks plausible relative to the garment (not comically large or a speck)
- No visible image stretch/distortion on the garment photo itself

## T-shirt

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied — y 257→292 |
| Right Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied — y 257→292 |
| Across Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied — y 231→268 |
| Full Front (Front) | | Not touched by the neck-clearance patch |
| Left Sleeve (Front) | | Not touched by the neck-clearance patch |
| Right Sleeve (Front) | | Not touched by the neck-clearance patch |
| Top Back (Back) | RETEST REQUIRED | Neck-clearance patch applied — y 180→215 |
| Full Back (Back) | | Not touched by the neck-clearance patch |
| Bottom Back (Back) | | Not touched by the neck-clearance patch |

## Hoody

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | RETEST REQUIRED | Check it clears the drawstrings/hood — neck-clearance patch applied, y 334→358 |
| Right Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 334→358 |
| Across Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 308→330 |
| Full Front (Front) | | Check it stays clear of the kangaroo pocket — not touched by the neck-clearance patch |
| Left Sleeve (Front) | | Not touched by the neck-clearance patch |
| Right Sleeve (Front) | | Not touched by the neck-clearance patch |
| Top Back (Back) | RETEST REQUIRED | Check it clears the hood's draped flap — neck-clearance patch applied, y 380→400 |
| Full Back (Back) | | Check it clears the hood's draped flap — not touched by the neck-clearance patch |

## Polo

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | RETEST REQUIRED | Check it clears the button placket — neck-clearance patch applied, y 257→298 (largest correction of any garment) |
| Right Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 257→298 |
| Across Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 257→278 |
| Full Front (Front) | | Not touched by the neck-clearance patch |
| Top Back (Back) | RETEST REQUIRED | Check it clears the rear collar — neck-clearance patch applied, y 180→218 |
| Full Back (Back) | | Not touched by the neck-clearance patch |

## Crew Neck

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 257→288 |
| Right Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 257→288 |
| Across Chest (Front) | RETEST REQUIRED | Neck-clearance patch applied, y 231→258 |
| Full Front (Front) | | Not touched by the neck-clearance patch |
| Left Sleeve (Front) | | Long-sleeve placement, not the T-shirt's short-sleeve spot — not touched by the neck-clearance patch |
| Right Sleeve (Front) | | Not touched by the neck-clearance patch |
| Top Back (Back) | RETEST REQUIRED | Neck-clearance patch applied, y 180→212 |
| Full Back (Back) | | Not touched by the neck-clearance patch |

## Cross-surface consistency

Pick one order with a saved mockup and confirm the *same* placement appears on all of these:

| Surface | Result | Notes |
|---|---|---|
| Mockup Studio (live editor) | | |
| Orders list thumbnail | | |
| Production Board thumbnail | | |
| Order Detail — Overview tab | | |
| Order Detail — Artwork & Mockups tab | | |
| Preview Drawer (click any thumbnail) | | |
| Downloaded saved preview PNG | | |

## Known-unsupported (expected, not a bug)

These should show the garment alone with a "not configured for this garment" state — not a crash, not a fabricated placement:

- Shorts / Pants — any position
- Bennie / Hats — any position

## After running this

Update `src/config/garmentGeometry.ts`'s `CALIBRATION_CONFIDENCE` entries and the relevant zone coordinates for anything marked ADJUST or FAIL, then re-run this checklist for the affected garment before considering it resolved.
