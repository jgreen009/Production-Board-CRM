import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import type { GarmentType } from '@/types'
import type { PrintZone } from '@/config/printZones'
import { garmentTemplateToDataUrl } from '@/config/garmentTemplates'
import { physicalSizeToPixelSize, zoneBoxPx, zoneOffsetToCanvasPosition } from '@/utils/mockupGeometry'

// Phase 3 Batch A — the real interactive Mockup Studio canvas, replacing
// the Milestone 1 architectural spike. Editing-only: read-only surfaces
// (Order Detail, etc.) keep using the lightweight GarmentMockup renderer.
//
// Pre-UAT product decision: the selected print position is now
// authoritative for artwork placement — staff no longer drag artwork
// around the garment. This component is a pure renderer: it draws the
// garment, the zone guide, and the artwork at the position/size the
// canonical `transform` prop (and the zone it's rendered against)
// dictate, and never writes anything back. Resize (via Fabric handles)
// and rotation were already made non-interactive in an earlier pass
// (auto-fit sizing, always-upright artwork); this removes the one
// remaining interactive gesture (drag) and the now-fully-unreachable
// imperative center/reset handle that went with it — nothing called it
// (no `ref` was ever passed to this component from MockupStudio), and
// keeping it would misleadingly imply a movement model that no longer
// exists. `offsetX`/`offsetY` remain on `MockupTransform` and the
// `print_specs` table for backward compatibility (existing historical
// data), but this renderer center the artwork within its zone
// deterministically — see MockupStudio.tsx.

export interface MockupTransform {
  offsetX: number
  offsetY: number
  rotationDeg: number
  widthMm: number
  heightMm: number
}

interface MockupCanvasProps {
  width: number
  height: number
  garmentType: GarmentType
  garmentColour: string
  view: 'Front' | 'Back'
  zone: PrintZone
  /** Signed/object URL for previewable artwork — undefined shows the zone guide with no artwork. */
  artworkUrl?: string
  /** Canonical PrintSpec transform — the single source of truth this canvas renders from. Never written back. */
  transform: MockupTransform
  /** Reports the loaded artwork's intrinsic aspect ratio (width/height), or null while none is loaded. */
  onArtworkAspectRatio?: (ratio: number | null) => void
  onError?: (message: string) => void
}

export function MockupCanvas({
  width,
  height,
  garmentType,
  garmentColour,
  view,
  zone,
  artworkUrl,
  transform,
  onArtworkAspectRatio,
  onError,
}: MockupCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const artworkObjectRef = useRef<fabric.FabricImage | null>(null)
  const guideRectRef = useRef<fabric.Rect | null>(null)

  // Latest-value refs so the init effect (which must run once) and the
  // async image-load effects always see current props without re-creating
  // the Fabric canvas or re-subscribing listeners on every prop change.
  const zoneRef = useRef(zone)
  const transformRef = useRef(transform)
  const onArtworkAspectRatioRef = useRef(onArtworkAspectRatio)
  const onErrorRef = useRef(onError)
  zoneRef.current = zone
  transformRef.current = transform
  onArtworkAspectRatioRef.current = onArtworkAspectRatio
  onErrorRef.current = onError

  function syncGuide() {
    const canvas = fabricCanvasRef.current
    const guide = guideRectRef.current
    if (!canvas || !guide) return
    const zonePx = zoneBoxPx(zoneRef.current, canvas.getWidth(), canvas.getHeight())
    guide.set({ left: zonePx.x, top: zonePx.y, width: zonePx.width, height: zonePx.height })
    guide.setCoords()
  }

  // Rebuilds the artwork object's on-canvas position/size/rotation purely
  // from the canonical transform + current zone/canvas size — never the
  // other way around. The artwork object is non-interactive (see below),
  // so this is the ONLY thing that ever moves, sizes, or rotates it.
  function syncArtworkTransform() {
    const canvas = fabricCanvasRef.current
    const obj = artworkObjectRef.current
    if (!canvas || !obj) return
    const zonePx = zoneBoxPx(zoneRef.current, canvas.getWidth(), canvas.getHeight())
    const pos = zoneOffsetToCanvasPosition(
      { offsetX: transformRef.current.offsetX, offsetY: transformRef.current.offsetY },
      zonePx,
    )
    const size = physicalSizeToPixelSize(transformRef.current.widthMm, transformRef.current.heightMm, zoneRef.current, zonePx)
    const naturalWidth = obj.width || 1
    const naturalHeight = obj.height || 1
    obj.set({
      left: pos.left,
      top: pos.top,
      angle: transformRef.current.rotationDeg,
      scaleX: size.widthPx / naturalWidth,
      scaleY: size.heightPx / naturalHeight,
    })
    obj.setCoords()
  }

  // Canvas init — runs once. Fabric init failure is caught so a broken
  // canvas doesn't take down the surrounding order form.
  useEffect(() => {
    if (!canvasElRef.current) return
    let canvas: fabric.Canvas
    try {
      canvas = new fabric.Canvas(canvasElRef.current, { width, height, selection: false })
    } catch {
      onErrorRef.current?.('Could not initialize the mockup canvas.')
      return
    }
    fabricCanvasRef.current = canvas

    const guide = new fabric.Rect({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: '#000000',
      strokeDashArray: [6, 4],
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    })
    canvas.add(guide)
    guideRectRef.current = guide
    syncGuide()

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
      artworkObjectRef.current = null
      guideRectRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Container resize (ResizeObserver-driven, from the parent) — presentation
  // only: recompute pixel geometry from the same canonical form values, never
  // write anything back to form state just because the viewport changed.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    canvas.setDimensions({ width, height })
    const bg = canvas.backgroundImage
    if (bg) {
      bg.set({ scaleX: width / (bg.width || 1), scaleY: height / (bg.height || 1) })
    }
    syncGuide()
    syncArtworkTransform()
    canvas.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // Garment background — reloads on type/colour/view change. Locked,
  // non-selectable, non-evented by construction (Fabric background images
  // are never interactive), and excluded from any future export.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    let cancelled = false
    ;(async () => {
      try {
        const url = garmentTemplateToDataUrl(garmentType, view, garmentColour)
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        if (cancelled) return
        img.set({
          scaleX: canvas.getWidth() / (img.width || 1),
          scaleY: canvas.getHeight() / (img.height || 1),
          selectable: false,
          evented: false,
          excludeFromExport: true,
        })
        canvas.backgroundImage = img
        canvas.requestRenderAll()
      } catch {
        if (!cancelled) onErrorRef.current?.('Could not load the garment template for this preview.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [garmentType, garmentColour, view])

  // Artwork object — reloads whenever the selected artwork's preview URL
  // changes (including to/from undefined, e.g. a non-previewable file or
  // no selection). Old object is always removed first so nothing stale
  // lingers on the canvas.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    let cancelled = false

    if (artworkObjectRef.current) {
      canvas.remove(artworkObjectRef.current)
      artworkObjectRef.current = null
    }
    onArtworkAspectRatioRef.current?.(null)
    canvas.requestRenderAll()

    if (!artworkUrl) return

    ;(async () => {
      try {
        const img = await fabric.FabricImage.fromURL(artworkUrl, { crossOrigin: 'anonymous' })
        if (cancelled) return
        // The print position is authoritative for placement — artwork is
        // never draggable, resizable via handles, or rotatable by hand.
        // `selectable: false` + `evented: false` make it fully inert to
        // mouse/touch input (no click-to-select, no drag, no handles ever
        // rendered); position/size/rotation only ever change by re-running
        // syncArtworkTransform() from the canonical transform prop below.
        img.set({
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
        })
        canvas.add(img)
        artworkObjectRef.current = img
        onArtworkAspectRatioRef.current?.((img.width || 1) / (img.height || 1))
        syncArtworkTransform()
        canvas.requestRenderAll()
      } catch {
        if (!cancelled) onErrorRef.current?.('Could not load this artwork preview.')
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkUrl])

  // Re-sync position/size/rotation whenever the canonical transform prop
  // changes — covers switching PrintSpec (rehydrate from the newly active
  // spec) and a physical-size change from the surrounding form.
  useEffect(() => {
    syncArtworkTransform()
    fabricCanvasRef.current?.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform.offsetX, transform.offsetY, transform.rotationDeg, transform.widthMm, transform.heightMm])

  // Re-sync the zone guide + artwork placement whenever the active print
  // position's zone changes — physical width/height are preserved (they
  // come from the transform prop unchanged); only their on-canvas pixel
  // representation is recalculated against the new zone's calibration.
  useEffect(() => {
    syncGuide()
    syncArtworkTransform()
    fabricCanvasRef.current?.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone])

  return <canvas ref={canvasElRef} width={width} height={height} role="img" aria-label="Mockup preview canvas" />
}
