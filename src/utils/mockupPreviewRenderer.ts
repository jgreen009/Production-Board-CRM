import * as fabric from 'fabric'
import type { GarmentType } from '@/types'
import type { PrintZone } from '@/config/printZones'
import { garmentTemplateToDataUrl } from '@/config/garmentTemplates'
import { physicalSizeToPixelSize, zoneBoxPx, zoneOffsetToCanvasPosition } from '@/utils/mockupGeometry'

// Phase 3 Batch B — clean PNG export. Deliberately a SEPARATE render path
// from the interactive MockupCanvas.tsx rather than exporting the live
// editing canvas: a plain fabric.StaticCanvas is built fresh here with only
// the garment background and the artwork object ever added to it, so there
// is no print-zone guide, no selection controls, and no editor chrome to
// have to filter out — nothing extra is ever added to this canvas in the
// first place. (fabric's `excludeFromExport` object flag, used elsewhere in
// this codebase's interactive canvas, only affects toObject/toJSON
// serialization, not pixel rendering — it would NOT have hidden the guide
// from a toDataURL() export, which is the real reason this stays a
// separate canvas rather than reusing MockupCanvas's live one.)

// Matches GARMENT_VIEW_BOX (240x300) at 3x — 720x900px output. Sharp enough
// to be a clear staff/customer reference image without being unnecessarily
// large; this is a visual proof, not print-production source artwork.
export const PREVIEW_BASE_WIDTH = 240
export const PREVIEW_BASE_HEIGHT = 300
export const PREVIEW_MULTIPLIER = 3

export interface MockupPreviewInput {
  garmentType: GarmentType
  garmentColour: string
  view: 'Front' | 'Back'
  zone: PrintZone
  /** Previewable artwork URL (signed URL or blob: URL) — omitted renders the garment alone. */
  artworkUrl?: string
  offsetX: number
  offsetY: number
  rotationDeg: number
  widthMm: number
  heightMm: number
}

// White background (not transparent): the garment templates themselves are
// already opaque white-background flats/photos (Milestone 2/asset swap), so
// a white canvas base is the choice that's actually consistent with what
// staff already see while editing, and gives a more reliable product-style
// preview than transparency would against art that isn't itself transparent.
const BACKGROUND_COLOUR = '#ffffff'

export async function renderMockupPreviewPng(input: MockupPreviewInput): Promise<Blob> {
  const width = PREVIEW_BASE_WIDTH * PREVIEW_MULTIPLIER
  const height = PREVIEW_BASE_HEIGHT * PREVIEW_MULTIPLIER
  const canvasEl = document.createElement('canvas')
  const canvas = new fabric.StaticCanvas(canvasEl, { width, height, backgroundColor: BACKGROUND_COLOUR })

  try {
    const garmentUrl = garmentTemplateToDataUrl(input.garmentType, input.view, input.garmentColour)
    const garmentImg = await fabric.FabricImage.fromURL(garmentUrl, { crossOrigin: 'anonymous' })
    garmentImg.set({
      scaleX: width / (garmentImg.width || 1),
      scaleY: height / (garmentImg.height || 1),
    })
    canvas.backgroundImage = garmentImg

    if (input.artworkUrl) {
      const artworkImg = await fabric.FabricImage.fromURL(input.artworkUrl, { crossOrigin: 'anonymous' })
      const zonePx = zoneBoxPx(input.zone, width, height)
      const pos = zoneOffsetToCanvasPosition({ offsetX: input.offsetX, offsetY: input.offsetY }, zonePx)
      const size = physicalSizeToPixelSize(input.widthMm, input.heightMm, input.zone, zonePx)
      artworkImg.set({
        originX: 'center',
        originY: 'center',
        left: pos.left,
        top: pos.top,
        angle: input.rotationDeg,
        scaleX: size.widthPx / (artworkImg.width || 1),
        scaleY: size.heightPx / (artworkImg.height || 1),
      })
      canvas.add(artworkImg)
    }

    canvas.renderAll()
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
    const response = await fetch(dataUrl)
    return await response.blob()
  } finally {
    canvas.dispose()
  }
}
