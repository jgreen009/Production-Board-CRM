import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GarmentType, PrintPosition } from '@/types'
import { getPrintZone } from '@/config/printZones'
import { GARMENT_VIEW_BOX, getGarmentShapeStyle, getGarmentShapes, getGarmentTemplate } from '@/config/garmentTemplates'
import { resolveGarmentColour } from '@/utils/colour'

export interface MockupOffset {
  x: number
  y: number
}

interface GarmentMockupProps {
  garmentType: GarmentType
  colour: string
  view: 'Front' | 'Back'
  position: PrintPosition
  artworkUrl?: string
  widthMm: number
  heightMm: number
  offset: MockupOffset
  onOffsetChange: (offset: MockupOffset) => void
  size?: number
}

function isPositionVisible(position: PrintPosition, view: 'Front' | 'Back'): boolean {
  return getPrintZone(position).view === view
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function GarmentMockup({
  garmentType,
  colour,
  view,
  position,
  artworkUrl,
  widthMm,
  heightMm,
  offset,
  onOffsetChange,
  size = 260,
}: GarmentMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ startX: number; startY: number; startOffset: MockupOffset } | null>(null)

  const template = getGarmentTemplate(garmentType)
  const zone = getPrintZone(position)
  // GarmentMockup still works in center-point coordinates (this component's
  // drag/clamp math predates the Phase 3 print-zone reshape and is left
  // as-is here — replacing it is Milestone 3/4's job, not Milestone 1's
  // architecture-only scope). Center is derived from the zone's top-left
  // box shape so behavior is unchanged even though the config shape is new.
  const zoneCenter = { x: zone.xPct + zone.widthPct / 2, y: zone.yPct + zone.heightPct / 2 }
  const base = template.printAnchorOverride ?? zoneCenter
  const visible = template.printAnchorOverride ? true : isPositionVisible(position, view)
  const shapes = getGarmentShapes(garmentType, view)
  const shapeFill = resolveGarmentColour(colour)

  // Print box size as a percentage of the garment image, scaled from the
  // real mm dimensions but capped to the selected position's own realistic
  // print area (a sleeve can't hold an "Oversize" print, Full Front can) —
  // so the box always fits within the position rather than overflowing it.
  const maxWidthPct = template.printAnchorOverride ? 30 : zone.widthPct
  const maxHeightPct = template.printAnchorOverride ? 22 : zone.heightPct
  const artWidthPct = clamp(widthMm * 0.15, 8, maxWidthPct)
  const artHeightPct = clamp(heightMm * 0.15, 8, maxHeightPct)

  const CANVAS_MARGIN_PCT = 2
  const rawX = base.x + offset.x
  const rawY = base.y + offset.y + (template.verticalOffsetPct ?? 0)
  const artX = clamp(rawX, CANVAS_MARGIN_PCT + artWidthPct / 2, 100 - CANVAS_MARGIN_PCT - artWidthPct / 2)
  const artY = clamp(rawY, CANVAS_MARGIN_PCT + artHeightPct / 2, 100 - CANVAS_MARGIN_PCT - artHeightPct / 2)

  const handlePointerDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dxPct = ((e.clientX - dragging.current.startX) / rect.width) * 100
    const dyPct = ((e.clientY - dragging.current.startY) / rect.height) * 100
    onOffsetChange({
      x: clamp(dragging.current.startOffset.x + dxPct, -40, 40),
      y: clamp(dragging.current.startOffset.y + dyPct, -40, 40),
    })
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLImageElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragging.current = null
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto select-none"
      style={{ width: size }}
    >
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

      {visible && artworkUrl && (
        <img
          src={artworkUrl}
          alt="Artwork placement"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute cursor-grab touch-none rounded-sm object-contain active:cursor-grabbing"
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
          className="absolute rounded-sm border-2 border-dashed border-zinc-900/30"
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
