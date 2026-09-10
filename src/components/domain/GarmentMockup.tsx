import type { GarmentType, PrintPosition } from '@/types'
import { getPrintZone } from '@/config/printZones'
import { GARMENT_VIEW_BOX, getGarmentImage, getGarmentShapeStyle, getGarmentShapes, getGarmentTemplate } from '@/config/garmentTemplates'
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
}

function isPositionVisible(position: PrintPosition, view: 'Front' | 'Back'): boolean {
  return getPrintZone(position).view === view
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// A lightweight, read-only silhouette fallback for surfaces that must never
// import Fabric (Order Detail before a real preview exists, Settings
// Mockup Templates). Pre-UAT product decision: the print position is
// authoritative for placement everywhere in the app now, so this always
// renders centered in its zone — it used to accept a draggable offset
// (both of its two call sites passed a no-op onOffsetChange, so nothing
// was ever actually persisted from it; the drag affordance was already
// non-functional, just visually misleading — removed along with the
// dead prop rather than left wired to nothing).
export function GarmentMockup({
  garmentType,
  colour,
  view,
  position,
  artworkUrl,
  widthMm,
  heightMm,
  size = 260,
}: GarmentMockupProps) {
  const template = getGarmentTemplate(garmentType)
  const zone = getPrintZone(position)
  const zoneCenter = { x: zone.xPct + zone.widthPct / 2, y: zone.yPct + zone.heightPct / 2 }
  const base = template.printAnchorOverride ?? zoneCenter
  const visible = template.printAnchorOverride ? true : isPositionVisible(position, view)
  const shapes = getGarmentShapes(garmentType, view)
  const shapeFill = resolveGarmentColour(colour)
  const garmentImage = getGarmentImage(garmentType, view)

  // Print box size as a percentage of the garment image, scaled from the
  // real mm dimensions but capped to the selected position's own realistic
  // print area (a sleeve can't hold an "Oversize" print, Full Front can) —
  // so the box always fits within the position rather than overflowing it.
  const maxWidthPct = template.printAnchorOverride ? 30 : zone.widthPct
  const maxHeightPct = template.printAnchorOverride ? 22 : zone.heightPct
  const artWidthPct = clamp(widthMm * 0.15, 8, maxWidthPct)
  const artHeightPct = clamp(heightMm * 0.15, 8, maxHeightPct)

  const CANVAS_MARGIN_PCT = 2
  const rawX = base.x
  const rawY = base.y + (template.verticalOffsetPct ?? 0)
  const artX = clamp(rawX, CANVAS_MARGIN_PCT + artWidthPct / 2, 100 - CANVAS_MARGIN_PCT - artWidthPct / 2)
  const artY = clamp(rawY, CANVAS_MARGIN_PCT + artHeightPct / 2, 100 - CANVAS_MARGIN_PCT - artHeightPct / 2)

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

      {visible && artworkUrl && (
        <img
          src={artworkUrl}
          alt="Artwork placement"
          className="pointer-events-none absolute rounded-sm object-contain"
          style={{
            left: `${artX}%`,
            top: `${artY}%`,
            width: `${artWidthPct}%`,
            height: `${artHeightPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      {visible && !artworkUrl && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-zinc-900/30"
          style={{
            left: `${artX}%`,
            top: `${artY}%`,
            width: `${artWidthPct}%`,
            height: `${artHeightPct}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  )
}
