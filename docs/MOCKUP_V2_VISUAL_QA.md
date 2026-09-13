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

## Beanie

Non-upper-body extension — first calibration pass, never visually confirmed in a browser. Both positions **RETEST REQUIRED**.

| Position | Result | Notes |
|---|---|---|
| Front (cuff patch) | RETEST REQUIRED | Verified against bennie-front.png — centered patch on the folded cuff band |
| Back where supported | RETEST REQUIRED | Reuses Front's cuff-patch coordinates — bennie-back.png shows no distinguishing rear feature to calibrate independently against (CALIBRATION_CONFIDENCE: 'inferred') |

## Hat / Cap

| Position | Result | Notes |
|---|---|---|
| Front (crown logo) | RETEST REQUIRED | Verified against hats-front.png — centered crown panel between the two eyelets |
| Back | RETEST REQUIRED | Verified against hats-back.png — crown panel above the strap/buckle |
| Left Side / Right Side | DEFERRED | No side-view asset exists (only front.png/back.png) — not exposed to any garment; do not add until real side-view art is supplied |

## Shorts

| Position | Result | Notes |
|---|---|---|
| Left Leg | RETEST REQUIRED | Verified against shorts-front.png — lower-leg-panel logo box, below the pocket seams |
| Right Leg | RETEST REQUIRED | Mirror of Left Leg |
| Back | RETEST REQUIRED | Verified against shorts-back.png — centered seat-area box below the waistband |

The user must never see Left Chest/Right Chest/Across Chest/Sleeve options for Shorts — confirm the position buttons show only Left Leg/Right Leg/Back.

## Pants

| Position | Result | Notes |
|---|---|---|
| Left Thigh | RETEST REQUIRED | Verified against pants-front.png — upper-leg-panel box below the pocket bag |
| Right Thigh | RETEST REQUIRED | Mirror of Left Thigh |
| Left Leg | RETEST REQUIRED | Verified against pants-front.png — lower-leg-panel box, well above the hem |
| Right Leg | RETEST REQUIRED | Mirror of Left Leg |
| Back | RETEST REQUIRED | Verified against pants-back.png — centered band spanning both back pockets |

Confirm the position buttons never show any upper-body position (Left Chest, Across Chest, etc.) for Pants.

## Non-upper-body cross-cutting checks

- Selecting Beanie/Hats/Shorts/Pants must show the garment mockup **immediately** — it must never fall back to a generic icon or blank state just because the position vocabulary differs from T-shirt's.
- Changing garment type away from Beanie/Hats/Shorts/Pants (or into them) mid-session must replace an now-invalid position with that garment's own default (Beanie/Hats → Front, Shorts → Left Leg, Pants → Left Thigh) rather than leaving a stale, unsupported position selected.
- An older order saved before this extension existed (a Shorts/Beanie/Hats/Pants order whose PrintSpec still holds an old upper-body position like "Left Chest") must render the garment mockup safely with a clear "not available for this garment" note — never crash, never silently move the print to an unrelated new position.

## After running this

Update `src/config/garmentGeometry.ts`'s `CALIBRATION_CONFIDENCE` entries and the relevant zone coordinates for anything marked ADJUST or FAIL, then re-run this checklist for the affected garment before considering it resolved.
