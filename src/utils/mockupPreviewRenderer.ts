import * as fabric from 'fabric'
import type { GarmentType, PrintPosition } from '@/types'
import { getPositionView, resolveGarmentGeometry, resolvePrintZone } from '@/config/garmentGeometry'
import { garmentTemplateToDataUrl } from '@/config/garmentTemplates'
import { fitGarmentIntoViewport } from '@/utils/garmentFit'
import { resolveArtworkPlacement } from '@/utils/mockupGeometry'

// Phase 3 Batch B — clean PNG export. Deliberately a SEPARATE render path
// from the interactive MockupCanvas.tsx rather than exporting the live
// editing canvas: a plain fabric.StaticCanvas is built fresh here with only
// the garment background and the artwork object ever added to it, so there
// is no print-zone guide, no selection controls, and no editor chrome to
// have to filter out — nothing extra is ever added to this canvas in the
// first place.
//
// Mockup System V2 Batch A: uses the same garment-specific canonical
// geometry and aspect-ratio-preserving fit as MockupCanvas.tsx and
// GarmentMockup.tsx (Part 11 "unify all three renderers") — no independent
// scaleX/scaleY stretch, no offsetX/offsetY reposition, always centered on
// the position's configured anchor.

// Output width in px — a sharp reference image without shipping the
// garment photo's own full native resolution (visual proof, not
// print-production source artwork). Height is derived from the garment's
// own canonical aspect ratio via the same fit helper every renderer uses,
// so this output is never independently stretched either.
export const PREVIEW_OUTPUT_WIDTH = 900

export interface MockupPreviewInput {
  garmentType: GarmentType
  garmentColour: string
  position: PrintPosition
  /** Previewable artwork URL (signed URL or blob: URL) — omitted renders the garment alone. */
  artworkUrl?: string
  rotationDeg: number
  widthMm: number
  heightMm: number
}

// White background (not transparent): the garment templates themselves are
// already opaque white-background flats/photos, so a white canvas base is
// the choice that's actually consistent with what staff already see while
// editing, and gives a more reliable product-style preview than
// transparency would against art that isn't itself transparent.
const BACKGROUND_COLOUR = '#ffffff'

export async function renderMockupPreviewPng(input: MockupPreviewInput): Promise<Blob> {
  const view = getPositionView(input.position)
  const viewGeometry = resolveGarmentGeometry(input.garmentType, view)
  const outputScale = PREVIEW_OUTPUT_WIDTH / viewGeometry.viewBox.width
  const width = PREVIEW_OUTPUT_WIDTH
  const height = viewGeometry.viewBox.height * outputScale
  const canvasEl = document.createElement('canvas')
  const canvas = new fabric.StaticCanvas(canvasEl, { width, height, backgroundColor: BACKGROUND_COLOUR })

  try {
    const garmentUrl = garmentTemplateToDataUrl(input.garmentType, view, input.garmentColour)
    const garmentImg = await fabric.FabricImage.fromURL(garmentUrl, { crossOrigin: 'anonymous' })
    const fit = fitGarmentIntoViewport(viewGeometry.viewBox.width, viewGeometry.viewBox.height, width, height)
    garmentImg.set({ left: fit.x, top: fit.y, originX: 'left', originY: 'top', scaleX: fit.scale, scaleY: fit.scale })
    canvas.backgroundImage = garmentImg

    const zone = resolvePrintZone(input.garmentType, view, input.position)
    if (input.artworkUrl && zone) {
      const artworkImg = await fabric.FabricImage.fromURL(input.artworkUrl, { crossOrigin: 'anonymous' })
      const placement = resolveArtworkPlacement(zone, fit, input.widthMm, input.heightMm)
      artworkImg.set({
        originX: 'center',
        originY: 'center',
        left: placement.centerX,
        top: placement.centerY,
        angle: input.rotationDeg,
        scaleX: placement.width / (artworkImg.width || 1),
        scaleY: placement.height / (artworkImg.height || 1),
      })
      canvas.add(artworkImg)
    }
    // Unsupported garment/position combination (no calibrated zone) — the
    // garment still renders (Part 19: historical PrintSpecs still render),
    // just without a fabricated artwork placement on top of it.

    canvas.renderAll()
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
    const response = await fetch(dataUrl)
    return await response.blob()
  } finally {
    canvas.dispose()
  }
}
