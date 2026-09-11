# Mockup System V2 — Visual QA Checklist

A short, human-executable checklist for confirming mockup placement looks right in a real browser. Not a UAT suite — just the mockup visuals. Run this after any geometry or asset change to the priority garments.

**How to run it**: open the New/Edit Order form, add a print location, and step through each row below, switching garment type/position/colour as needed. For each row, record **PASS**, **ADJUST** (looks close but needs a coordinate tweak in `src/config/garmentGeometry.ts`), or **FAIL** (materially wrong — e.g. off the garment, wrong view, or crashed).

As of Batch C, this checklist has **not been run** — no browser tooling has been available to any session that worked on Mockup System V2 so far. Every placement value has been calibrated by direct visual inspection of the source garment photos and verified with pure geometry math (unit tests), but never confirmed in an actual rendered `<canvas>`/`<img>`. Run this before treating placement as production-confirmed.

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
| Left Chest (Front) | | |
| Right Chest (Front) | | |
| Across Chest (Front) | | |
| Full Front (Front) | | |
| Left Sleeve (Front) | | |
| Right Sleeve (Front) | | |
| Top Back (Back) | | |
| Full Back (Back) | | |
| Bottom Back (Back) | | |

## Hoody

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | | Check it clears the drawstrings/hood |
| Right Chest (Front) | | |
| Full Front (Front) | | Check it stays clear of the kangaroo pocket |
| Left Sleeve (Front) | | |
| Right Sleeve (Front) | | |
| Top Back (Back) | | Check it clears the hood's draped flap |
| Full Back (Back) | | Check it clears the hood's draped flap |

## Polo

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | | Check it clears the button placket |
| Right Chest (Front) | | |
| Full Front (Front) | | |
| Top Back (Back) | | |
| Full Back (Back) | | |

## Crew Neck

| Position | Result | Notes |
|---|---|---|
| Left Chest (Front) | | |
| Right Chest (Front) | | |
| Full Front (Front) | | |
| Left Sleeve (Front) | | Long-sleeve placement, not the T-shirt's short-sleeve spot |
| Right Sleeve (Front) | | |
| Top Back (Back) | | |
| Full Back (Back) | | |

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
