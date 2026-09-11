import { describe, expect, it } from 'vitest'
import { computeAssetCorrectedScale, fitGarmentIntoViewport, mapCanonicalPointToViewport, mapCanonicalRectToViewport } from './garmentFit'

describe('fitGarmentIntoViewport', () => {
  it('preserves a portrait-ish source aspect ratio inside a wider target (letterboxed left/right)', () => {
    // source narrower/taller than target
    const fit = fitGarmentIntoViewport(1000, 2000, 1000, 1000)
    expect(fit.scale).toBeCloseTo(0.5, 10)
    expect(fit.width).toBeCloseTo(500, 10)
    expect(fit.height).toBeCloseTo(1000, 10)
    // centered horizontally
    expect(fit.x).toBeCloseTo((1000 - 500) / 2, 10)
    expect(fit.y).toBeCloseTo(0, 10)
  })

  it('preserves a landscape source aspect ratio inside a taller target (letterboxed top/bottom)', () => {
    const fit = fitGarmentIntoViewport(2000, 1000, 1000, 1000)
    expect(fit.scale).toBeCloseTo(0.5, 10)
    expect(fit.width).toBeCloseTo(1000, 10)
    expect(fit.height).toBeCloseTo(500, 10)
    expect(fit.x).toBeCloseTo(0, 10)
    expect(fit.y).toBeCloseTo((1000 - 500) / 2, 10)
  })

  it('produces zero offset and a single uniform scale when source and target share the same aspect ratio', () => {
    const fit = fitGarmentIntoViewport(1226, 1283, 613, 641.5)
    expect(fit.scale).toBeCloseTo(0.5, 5)
    expect(fit.x).toBeCloseTo(0, 6)
    expect(fit.y).toBeCloseTo(0, 6)
  })

  it('never produces different scaleX/scaleY — a single `scale` always applies uniformly to both axes', () => {
    const fit = fitGarmentIntoViewport(1226, 1283, 240, 300)
    // reconstructing width/height purely from scale must match the fit's own reported width/height
    expect(fit.width).toBeCloseTo(1226 * fit.scale, 8)
    expect(fit.height).toBeCloseTo(1283 * fit.scale, 8)
  })

  it('fits correctly inside a narrow mobile-sized viewport', () => {
    const fit = fitGarmentIntoViewport(1226, 1283, 220, 275)
    expect(fit.width).toBeLessThanOrEqual(220 + 1e-6)
    expect(fit.height).toBeLessThanOrEqual(275 + 1e-6)
    // touches at least one edge exactly (a true "contain" fit)
    const touchesWidth = Math.abs(fit.width - 220) < 1e-6
    const touchesHeight = Math.abs(fit.height - 275) < 1e-6
    expect(touchesWidth || touchesHeight).toBe(true)
  })

  it('fits correctly inside a wide desktop-sized viewport', () => {
    const fit = fitGarmentIntoViewport(1226, 1283, 1600, 900)
    expect(fit.width).toBeLessThanOrEqual(1600 + 1e-6)
    expect(fit.height).toBeLessThanOrEqual(900 + 1e-6)
    const touchesWidth = Math.abs(fit.width - 1600) < 1e-6
    const touchesHeight = Math.abs(fit.height - 900) < 1e-6
    expect(touchesWidth || touchesHeight).toBe(true)
  })

  it('degrades safely (no throw, no division by zero) for a not-yet-loaded (zero-size) source', () => {
    const fit = fitGarmentIntoViewport(0, 0, 240, 300)
    expect(fit).toEqual({ x: 0, y: 0, width: 240, height: 300, scale: 1 })
  })

  it('preserves proportions across a range of viewport resizes for the same source', () => {
    const source = { width: 1226, height: 1283 }
    const viewports = [
      { width: 220, height: 275 }, // mobile
      { width: 320, height: 400 }, // tablet
      { width: 800, height: 1000 }, // desktop
    ]
    for (const v of viewports) {
      const fit = fitGarmentIntoViewport(source.width, source.height, v.width, v.height)
      expect(fit.width / fit.height).toBeCloseTo(source.width / source.height, 5)
    }
  })
})

describe('mapCanonicalRectToViewport', () => {
  it('maps a canonical rect through the fit offset and scale', () => {
    const fit = fitGarmentIntoViewport(1000, 1000, 500, 500)
    const rect = mapCanonicalRectToViewport({ x: 100, y: 200, width: 300, height: 400 }, fit)
    expect(rect).toEqual({ x: 50, y: 100, width: 150, height: 200 })
  })

  it('accounts for letterbox offset when source/target aspect ratios differ', () => {
    const fit = fitGarmentIntoViewport(1000, 2000, 1000, 1000) // scale 0.5, x offset 250
    const rect = mapCanonicalRectToViewport({ x: 0, y: 0, width: 1000, height: 1000 }, fit)
    expect(rect.x).toBeCloseTo(250, 8)
    expect(rect.width).toBeCloseTo(500, 8)
  })
})

describe('mapCanonicalPointToViewport', () => {
  it('maps a canonical point through the fit offset and scale', () => {
    const fit = fitGarmentIntoViewport(1000, 1000, 500, 500)
    const point = mapCanonicalPointToViewport({ x: 500, y: 500 }, fit)
    expect(point).toEqual({ x: 250, y: 250 })
  })
})

// Mockup System V2 Batch C — "geometry safety" (Part 13 #14-16): an
// optimized garment asset's real pixel dimensions no longer match the
// declared canonical viewBox (1226x1283 -> ~900px long-edge webp), and
// this correction factor is what keeps Fabric's natural-size-relative
// scaling from silently shrinking every garment render by the resize
// ratio. Canonical zone coordinates themselves are never touched — only
// how a Fabric image object's scaleX/scaleY is computed from them.
describe('computeAssetCorrectedScale (Batch C: asset optimization does not alter canonical geometry)', () => {
  const viewBoxWidth = 1226
  const viewBoxHeight = 1283

  it('is a no-op (scale unchanged) when the asset natural size already matches the declared viewBox', () => {
    const fit = fitGarmentIntoViewport(viewBoxWidth, viewBoxHeight, 400, 500)
    const corrected = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, viewBoxWidth, viewBoxHeight)
    expect(corrected.scaleX).toBeCloseTo(fit.scale, 10)
    expect(corrected.scaleY).toBeCloseTo(fit.scale, 10)
  })

  it('scales up to compensate for a smaller optimized asset, rendering at the same on-screen size either way', () => {
    const targetWidth = 400
    const targetHeight = 500
    const fit = fitGarmentIntoViewport(viewBoxWidth, viewBoxHeight, targetWidth, targetHeight)

    // Original-resolution asset (natural size == viewBox)
    const originalCorrection = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, viewBoxWidth, viewBoxHeight)
    const originalRenderedWidth = viewBoxWidth * originalCorrection.scaleX

    // Optimized asset at 900px long-edge, same aspect ratio
    const naturalWidth = 860
    const naturalHeight = 900
    const optimizedCorrection = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, naturalWidth, naturalHeight)
    const optimizedRenderedWidth = naturalWidth * optimizedCorrection.scaleX

    // Same declared viewBox -> same rendered on-screen size, regardless of the asset's real resolution
    expect(optimizedRenderedWidth).toBeCloseTo(originalRenderedWidth, 6)
  })

  it('preserves aspect ratio: correcting width and height independently still yields a square rendering for a square asset/viewBox', () => {
    const fit = fitGarmentIntoViewport(1000, 1000, 500, 500)
    const corrected = computeAssetCorrectedScale(fit, 1000, 1000, 700, 700)
    const renderedWidth = 700 * corrected.scaleX
    const renderedHeight = 700 * corrected.scaleY
    expect(renderedWidth).toBeCloseTo(renderedHeight, 10)
  })

  it('does not mutate or depend on any canonical zone coordinate — pure function of fit + dimensions only', () => {
    const fit = fitGarmentIntoViewport(viewBoxWidth, viewBoxHeight, 300, 400)
    const before = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, 860, 900)
    const after = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, 860, 900)
    expect(after).toEqual(before)
  })

  it('degrades safely (no division by zero) for a zero-size natural dimension', () => {
    const fit = fitGarmentIntoViewport(viewBoxWidth, viewBoxHeight, 300, 400)
    const corrected = computeAssetCorrectedScale(fit, viewBoxWidth, viewBoxHeight, 0, 0)
    expect(Number.isFinite(corrected.scaleX)).toBe(true)
    expect(Number.isFinite(corrected.scaleY)).toBe(true)
  })
})
