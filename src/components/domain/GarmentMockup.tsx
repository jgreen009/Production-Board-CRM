import type { GarmentType, PrintPosition } from '@/types'
import { resolveGarmentGeometry, resolvePrintZone } from '@/config/garmentGeometry'
import { GARMENT_VIEW_BOX, getGarmentImage, getGarmentShapeStyle, getGarmentShapes } from '@/config/garmentTemplates'
import { canonicalUnitsPerMm } from '@/utils/mockupGeometry'
import { resolveGarmentColour } from '@/utils/colour'

interface GarmentMockupProps {
  garmentType: GarmentType
  colour: string
  view: 'Front' | 'Back'
  position: PrintPosition
  artworkUrl?: string
  widthMm: number
  heightMm: number
  size?: number
  /** Shows the dashed print-zone boundary tracker (resizes with the selected position, matching MockupCanvas.tsx's guide rect) — opt-in so passive display surfaces (Orders/Board thumbnails, Order Detail's "no preview yet" fallback, Settings template previews) keep their current clean look; only an active print-configuration surface (the public order form's print-details section) needs it. */
  showZoneGuide?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// A lightweight, read-only fallback for surfaces that must never import
// Fabric (Order Detail before a real preview exists, Settings Mockup
// Templates, the public order form). Pre-UAT product decision: the print
// position is authoritative for placement everywhere in the app now, so
// this always renders centered on the position's configured anchor — never
// a draggable offset.
//
// Mockup System V2 Batch A: placement now comes from the same
// garment-specific canonical geometry (config/garmentGeometry.ts) as
// MockupCanvas/mockupPreviewRenderer, converted to CSS percentages of the
// garment's own canonical viewBox — not the old global percentage table
// plus per-garment printAnchorOverride/verticalOffsetPct hacks. The garment
// <img>/<svg> itself was never independently stretched here (only `width`
// is set in CSS; height follows the image's/svg's own intrinsic ratio), so
// no aspect-fit correction was needed for the garment photo itself, only
// for where the artwork overlay is placed on top of it.
//
// The dashed "tracker" box shown here is the print POSITION's own zone
// boundary (zone.x/y/width/height) — it always reflects the selected
// position's real print area and resizes the moment the position changes
// (Left Chest's small box vs. Full Front's large one), exactly matching
// MockupCanvas.tsx's persistent `guide` rect on the staff Mockup Studio.
// It is intentionally a SEPARATE box from the artwork's own physical-size
// overlay below — the zone boundary never depends on widthMm/heightMm (a
// customer who hasn't touched the size preset yet must still see the
// tracker resize purely from picking a different position).
export function GarmentMockup({
  garmentType,
  colour,
  view,
  position,
  artworkUrl,
  widthMm,
  heightMm,
  size = 260,
  showZoneGuide = false,
}: GarmentMockupProps) {
  const viewGeometry = resolveGarmentGeometry(garmentType, view)
  const zone = resolvePrintZone(garmentType, view, position)
  const shapes = getGarmentShapes(garmentType, view)
  const shapeFill = resolveGarmentColour(colour)
  const garmentImage = getGarmentImage(garmentType, view)

  // Zone boundary tracker — a percentage-of-viewBox box straight from the
  // zone's own top-left/width/height, no artwork size involved at all.
  const zoneXPct = zone ? (zone.x / viewGeometry.viewBox.width) * 100 : 0
  const zoneYPct = zone ? (zone.y / viewGeometry.viewBox.height) * 100 : 0
  const zoneWidthPct = zone ? (zone.width / viewGeometry.viewBox.width) * 100 : 0
  const zoneHeightPct = zone ? (zone.height / viewGeometry.viewBox.height) * 100 : 0

  // Artwork overlay — the physical print size (widthMm/heightMm) the
  // customer/staff actually chose, centered on the zone's anchor. Usually
  // smaller than or equal to the zone boundary above, never independently
  // driving the tracker's own size.
  const anchorXPct = zone ? (zone.anchorX / viewGeometry.viewBox.width) * 100 : 50
  const anchorYPct = zone ? (zone.anchorY / viewGeometry.viewBox.height) * 100 : 50
  const unitsPerMm = zone ? canonicalUnitsPerMm(zone) : 0
  const artWidthPct = zone ? clamp(((widthMm * unitsPerMm) / viewGeometry.viewBox.width) * 100, 2, 100) : 0
  const artHeightPct = zone ? clamp(((heightMm * unitsPerMm) / viewGeometry.viewBox.height) * 100, 2, 100) : 0

  return (
    <div className="relative mx-auto select-none" style={{ width: size }}>
      {garmentImage ? (
        <img
          src={garmentImage}
          alt={`${garmentType} ${view}`}
          className="pointer-events-none block w-full"
          draggable={false}
        />
      ) : (
        <svg
          viewBox={GARMENT_VIEW_BOX}
          width={size}
          height={(size / 240) * 300}
          className="pointer-events-none block w-full"
          aria-label={`${garmentType} ${view}`}
        >
          {shapes.map((shape, i) => {
            const style = getGarmentShapeStyle(shape.role, shapeFill)
            return <path key={i} d={shape.d} fill={style.fill} stroke={style.stroke} />
          })}
        </svg>
      )}

      {zone && showZoneGuide && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-zinc-900/30"
          style={{
            left: `${zoneXPct}%`,
            top: `${zoneYPct}%`,
            width: `${zoneWidthPct}%`,
            height: `${zoneHeightPct}%`,
          }}
        />
      )}

      {zone && artworkUrl && (
        <img
          src={artworkUrl}
          alt="Artwork placement"
          className="pointer-events-none absolute rounded-sm object-contain"
          style={{
            left: `${anchorXPct}%`,
            top: `${anchorYPct}%`,
            width: `${artWidthPct}%`,
            height: `${artHeightPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  )
}
