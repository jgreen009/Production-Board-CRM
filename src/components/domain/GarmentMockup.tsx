import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GarmentType, PrintPosition } from '@/types'
import { resolveGarmentColour } from '@/utils/colour'
import { getPrintPositionConfig } from '@/data/printPositions'

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

const TEE_BODY =
  'M95,20 L70,35 L25,75 L70,92 L70,280 L170,280 L170,92 L215,75 L170,35 L145,20 Q120,38 95,20 Z'
const SINGLET_BODY = 'M100,20 L80,35 L80,280 L160,280 L160,35 L140,20 Q120,32 100,20 Z'
const VEST_BODY = 'M96,22 L78,38 L78,280 L162,280 L162,38 L144,22 Q120,34 96,22 Z'
const HOOD_PATH = 'M90,22 Q120,-12 150,22 L144,36 Q120,16 96,36 Z'

const FALLBACK_FAMILIES: GarmentType[] = ['Shorts', 'Pants', 'Bennie', 'Hats']

function isPositionVisible(position: PrintPosition, view: 'Front' | 'Back'): boolean {
  const config = getPrintPositionConfig(position)
  return config.view === 'Both' || config.view === view
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
  const dragging = useRef<{ startX: number; startY: number; startOffset: MockupOffset } | null>(null)

  const fill = resolveGarmentColour(colour)
  const base = getPrintPositionConfig(position)
  const visible = isPositionVisible(position, view)

  // Keep the print box within the visible canvas no matter what width/height
  // the user enters (manual mm entry isn't bounded by the UI) or which
  // position it's centered on — sleeve positions sit close to the canvas
  // edge, so an unclamped box can run off-canvas even at moderate sizes.
  const CANVAS_MARGIN = 8
  const artWidth = clamp(widthMm * 0.5, 30, 150)
  const artHeight = clamp(heightMm * 0.5, 30, 150)
  const rawX = base.x + offset.x
  const rawY = base.y + offset.y
  const artX = clamp(rawX, CANVAS_MARGIN + artWidth / 2, 240 - CANVAS_MARGIN - artWidth / 2)
  const artY = clamp(rawY, CANVAS_MARGIN + artHeight / 2, 300 - CANVAS_MARGIN - artHeight / 2)

  const handlePointerDown = (e: ReactPointerEvent<SVGImageElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGImageElement>) => {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.startX
    const dy = e.clientY - dragging.current.startY
    onOffsetChange({
      x: clamp(dragging.current.startOffset.x + dx, -70, 70),
      y: clamp(dragging.current.startOffset.y + dy, -100, 100),
    })
  }

  const handlePointerUp = (e: ReactPointerEvent<SVGImageElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragging.current = null
  }

  if (FALLBACK_FAMILIES.includes(garmentType)) {
    return (
      <svg viewBox="0 0 240 300" width={size} height={(size / 240) * 300} className="mx-auto">
        <rect x={60} y={60} width={120} height={200} rx={16} fill={fill} stroke="rgba(0,0,0,0.15)" />
        <text x={120} y={165} textAnchor="middle" fontSize={14} fill="rgba(0,0,0,0.4)">
          {garmentType}
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 240 300" width={size} height={(size / 240) * 300} className="mx-auto touch-none select-none">
      {garmentType === 'Singlet' && <path d={SINGLET_BODY} fill={fill} stroke="rgba(0,0,0,0.15)" />}
      {garmentType === 'Hi-Viz vest' && (
        <>
          <path d={VEST_BODY} fill={fill} stroke="rgba(0,0,0,0.15)" />
          <rect x={78} y={130} width={84} height={12} fill="#e5e7eb" opacity={0.9} />
          <rect x={78} y={210} width={84} height={12} fill="#e5e7eb" opacity={0.9} />
          {view === 'Front' && <line x1={120} y1={38} x2={120} y2={280} stroke="rgba(0,0,0,0.25)" strokeDasharray="4 3" />}
        </>
      )}
      {!['Singlet', 'Hi-Viz vest'].includes(garmentType) && (
        <>
          <path d={TEE_BODY} fill={fill} stroke="rgba(0,0,0,0.15)" />
          {garmentType === 'Hoody' && <path d={HOOD_PATH} fill={fill} stroke="rgba(0,0,0,0.15)" />}
          {garmentType === 'Polo' && view === 'Front' && (
            <>
              <path d="M108,22 L120,42 L132,22" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
              <line x1={120} y1={42} x2={120} y2={70} stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
            </>
          )}
        </>
      )}

      {visible && artworkUrl && (
        <image
          href={artworkUrl}
          x={artX - artWidth / 2}
          y={artY - artHeight / 2}
          width={artWidth}
          height={artHeight}
          preserveAspectRatio="xMidYMid meet"
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
      {visible && !artworkUrl && (
        <rect
          x={artX - artWidth / 2}
          y={artY - artHeight / 2}
          width={artWidth}
          height={artHeight}
          fill="none"
          stroke="rgba(0,0,0,0.25)"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
