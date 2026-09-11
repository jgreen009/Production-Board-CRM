import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import type { GarmentType, PrintPosition } from '@/types'
import { resolveGarmentGeometry, resolvePrintZone } from '@/config/garmentGeometry'
import { garmentTemplateToDataUrl } from '@/config/garmentTemplates'
import { fitGarmentIntoViewport, mapCanonicalRectToViewport, type FitResult } from '@/utils/garmentFit'
import { resolveArtworkPlacement } from '@/utils/mockupGeometry'

// Phase 3 Batch A — the real interactive Mockup Studio canvas, replacing
// the Milestone 1 architectural spike. Editing-only: read-only surfaces
// (Order Detail, etc.) keep using the lightweight GarmentMockup renderer.
//
// Pre-UAT product decision: the selected print position is now
// authoritative for artwork placement — staff no longer drag artwork
// around the garment. This component is a pure renderer: it draws the
// garment, the zone guide, and the artwork at the position/size the
// canonical garment/zone geometry (config/garmentGeometry.ts) dictates,
// and never writes anything back.
//
// Mockup System V2 Batch A: the garment background is no longer
// independently stretched on X/Y to fill the canvas (audit §7-8) — it is
// fit into the canvas preserving its own aspect ratio via
// fitGarmentIntoViewport, then the print zone/anchor (garment-specific,
// not the old global percentage table) is mapped through that same fit so
// garment and zone always share one coordinate space. `offsetX`/`offsetY`
// remain on `MockupTransform` and the `print_specs` table for backward
// compatibility (existing historical data) but are never read by this
// renderer — artwork is always centered on the zone's configured anchor.

// Mockup System V2 Batch A — dev-only geometry debug overlay (Part 26).
// Shows the garment's canonical bounds (blue) and the active zone's anchor
// point (red dot) on top of the normal dashed zone guide, to help
// calibrate print zones against the real photos during development. Never
// enabled in production — gated on both DEV mode and an explicit opt-in
// query flag so it never appears by accident.
function isGeometryDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mockupDebug') === '1'
}

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
  position: PrintPosition
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
  position,
  artworkUrl,
  transform,
  onArtworkAspectRatio,
  onError,
}: MockupCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const artworkObjectRef = useRef<fabric.FabricImage | null>(null)
  const guideRectRef = useRef<fabric.Rect | null>(null)
  const debugBoundsRectRef = useRef<fabric.Rect | null>(null)
  const debugAnchorDotRef = useRef<fabric.Circle | null>(null)
  // The garment's aspect-ratio-preserving fit within the current canvas
  // size — recomputed whenever the garment background loads or the canvas
  // resizes, and the single shared basis for both the zone guide and the
  // artwork placement below (Part 11: "no renderer may independently
  // calculate garment bounds, zone bounds, anchors, or mm scale").
  const fitRef = useRef<FitResult>({ x: 0, y: 0, width, height, scale: 1 })

  // Latest-value refs so the init effect (which must run once) and the
  // async image-load effects always see current props without re-creating
  // the Fabric canvas or re-subscribing listeners on every prop change.
  const garmentTypeRef = useRef(garmentType)
  const viewRef = useRef(view)
  const positionRef = useRef(position)
  const transformRef = useRef(transform)
  const onArtworkAspectRatioRef = useRef(onArtworkAspectRatio)
  const onErrorRef = useRef(onError)
  garmentTypeRef.current = garmentType
  viewRef.current = view
  positionRef.current = position
  transformRef.current = transform
  onArtworkAspectRatioRef.current = onArtworkAspectRatio
  onErrorRef.current = onError

  function currentZone() {
    return resolvePrintZone(garmentTypeRef.current, viewRef.current, positionRef.current)
  }

  function syncGuide() {
    const canvas = fabricCanvasRef.current
    const guide = guideRectRef.current
    if (!canvas || !guide) return
    const zone = currentZone()
    if (!zone) {
      // Unsupported garment/position combination (Part 16) — no fabricated
      // box; hide the guide entirely rather than guess a location.
      guide.set({ width: 0, height: 0 })
      guide.setCoords()
      return
    }
    const box = mapCanonicalRectToViewport(zone, fitRef.current)
    guide.set({ left: box.x, top: box.y, width: box.width, height: box.height })
    guide.setCoords()

    const anchorDot = debugAnchorDotRef.current
    if (anchorDot) {
      const anchor = mapCanonicalRectToViewport({ x: zone.anchorX, y: zone.anchorY, width: 0, height: 0 }, fitRef.current)
      anchorDot.set({ left: anchor.x, top: anchor.y })
      anchorDot.setCoords()
    }
  }

  function syncDebugBounds() {
    const boundsRect = debugBoundsRectRef.current
    if (!boundsRect) return
    const viewGeometry = resolveGarmentGeometry(garmentTypeRef.current, viewRef.current)
    const box = mapCanonicalRectToViewport(viewGeometry.garmentBounds, fitRef.current)
    boundsRect.set({ left: box.x, top: box.y, width: box.width, height: box.height })
    boundsRect.setCoords()
  }

  // Rebuilds the artwork object's on-canvas position/size purely from the
  // canonical transform + current zone/fit — never the other way around.
  // The artwork object is non-interactive (see below), so this is the ONLY
  // thing that ever moves or sizes it. Rotation is the one persisted value
  // still applied directly (Part 10: not expanded, not removed).
  function syncArtworkTransform() {
    const canvas = fabricCanvasRef.current
    const obj = artworkObjectRef.current
    if (!canvas || !obj) return
    const zone = currentZone()
    if (!zone) {
      // No calibrated zone for this garment/position — do not fake a
      // placement; leave the artwork object off-canvas rather than guess.
      obj.set({ left: -9999, top: -9999 })
      obj.setCoords()
      return
    }
    const placement = resolveArtworkPlacement(zone, fitRef.current, transformRef.current.widthMm, transformRef.current.heightMm)
    const naturalWidth = obj.width || 1
    const naturalHeight = obj.height || 1
    obj.set({
      left: placement.centerX,
      top: placement.centerY,
      angle: transformRef.current.rotationDeg,
      scaleX: placement.width / naturalWidth,
      scaleY: placement.height / naturalHeight,
    })
    obj.setCoords()
  }

  // Canvas init — runs once. Fabric init failure is caught so a broken
  // canvas doesn't take down the surrounding order form.
  useEffect(() => {
    if (!canvasElRef.current) return
    let canvas: fabric.Canvas
    try {
      canvas = new fabric.Canvas(canvasElRef.current, { width, height, selection: false, backgroundColor: '#ffffff' })
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

    if (isGeometryDebugEnabled()) {
      const boundsRect = new fabric.Rect({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: '#2563eb',
        strokeDashArray: [2, 3],
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
      })
      const anchorDot = new fabric.Circle({
        left: 0,
        top: 0,
        radius: 4,
        originX: 'center',
        originY: 'center',
        fill: '#dc2626',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
      })
      canvas.add(boundsRect)
      canvas.add(anchorDot)
      debugBoundsRectRef.current = boundsRect
      debugAnchorDotRef.current = anchorDot
    }

    syncGuide()
    syncDebugBounds()

    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
      artworkObjectRef.current = null
      guideRectRef.current = null
      debugBoundsRectRef.current = null
      debugAnchorDotRef.current = null
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
      const fit = fitGarmentIntoViewport(bg.width || 1, bg.height || 1, width, height)
      fitRef.current = fit
      bg.set({ left: fit.x, top: fit.y, scaleX: fit.scale, scaleY: fit.scale })
    }
    syncGuide()
    syncDebugBounds()
    syncArtworkTransform()
    canvas.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // Garment background — reloads on type/colour/view change. Locked,
  // non-selectable, non-evented by construction (Fabric background images
  // are never interactive), and excluded from any future export. Fit into
  // the canvas preserving its own aspect ratio (Batch A) rather than the
  // old independent scaleX/scaleY stretch.
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    let cancelled = false
    ;(async () => {
      try {
        const url = garmentTemplateToDataUrl(garmentType, view, garmentColour)
        const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
        if (cancelled) return
        // The declared canonical viewBox — not the runtime-measured asset
        // pixel size — is the authoritative source dimension for the fit,
        // so garment geometry and print-zone geometry always share exactly
        // one coordinate space (see garmentGeometry.ts's CANONICAL_VIEWPORT
        // comment for why this is safe for every calibrated/fallback type).
        const viewGeometry = resolveGarmentGeometry(garmentType, view)
        const fit = fitGarmentIntoViewport(viewGeometry.viewBox.width, viewGeometry.viewBox.height, canvas.getWidth(), canvas.getHeight())
        fitRef.current = fit
        img.set({
          left: fit.x,
          top: fit.y,
          originX: 'left',
          originY: 'top',
          scaleX: fit.scale,
          scaleY: fit.scale,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        })
        canvas.backgroundImage = img
        syncGuide()
        syncDebugBounds()
        syncArtworkTransform()
        canvas.requestRenderAll()
      } catch {
        if (!cancelled) onErrorRef.current?.('Could not load the garment template for this preview.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // rendered); position/size only ever change by re-running
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
  // position changes — physical width/height are preserved (they come from
  // the transform prop unchanged); only their on-canvas representation is
  // recalculated against the new (garment-specific) zone.
  useEffect(() => {
    syncGuide()
    syncArtworkTransform()
    fabricCanvasRef.current?.requestRenderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  return <canvas ref={canvasElRef} width={width} height={height} role="img" aria-label={`${garmentType} ${view} mockup preview — ${position}`} />
}
