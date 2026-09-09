import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as fabric from 'fabric'

// Phase 3 Milestone 1 architectural spike (docs/PHASE_3_PLAN.md §3/D1,
// Milestone 1 item 2). This component's only job is to prove the
// React <-> Fabric.js boundary works cleanly: own one canvas instance,
// initialize/dispose it correctly, and expose a small imperative API so
// the surrounding form code stays declarative React while Fabric owns only
// the actual canvas pixels. It intentionally does NOT yet implement the
// full Mockup Studio UI, print-zone rendering, drag/resize production
// behavior, or persistence — those are Milestones 2-6.

export interface MockupCanvasTransform {
  offsetXPct: number
  offsetYPct: number
  rotationDeg: number
}

export interface MockupCanvasHandle {
  /** Loads (or replaces) the background garment image. */
  setBackgroundImage: (url: string) => Promise<void>
  /** Loads (or replaces) the artwork image object on the canvas. */
  setArtworkImage: (url: string) => Promise<void>
  /** Current artwork placement, relative to canvas size (0-1) — never raw pixels, per hard constraint #5. */
  getTransform: () => MockupCanvasTransform | null
  setTransform: (transform: MockupCanvasTransform) => void
  centerHorizontally: () => void
  centerVertically: () => void
  resetRotation: () => void
}

interface MockupCanvasProps {
  width: number
  height: number
  onTransformChange?: (transform: MockupCanvasTransform) => void
}

export const MockupCanvas = forwardRef<MockupCanvasHandle, MockupCanvasProps>(function MockupCanvas(
  { width, height, onTransformChange },
  ref,
) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const artworkObjectRef = useRef<fabric.FabricImage | null>(null)

  useEffect(() => {
    if (!canvasElRef.current) return

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      selection: false,
    })
    fabricCanvasRef.current = canvas

    const emitTransform = () => {
      if (!onTransformChange) return
      const obj = artworkObjectRef.current
      if (!obj) return
      onTransformChange({
        offsetXPct: (obj.left ?? 0) / canvas.getWidth(),
        offsetYPct: (obj.top ?? 0) / canvas.getHeight(),
        rotationDeg: obj.angle ?? 0,
      })
    }
    canvas.on('object:modified', emitTransform)

    return () => {
      canvas.off('object:modified', emitTransform)
      canvas.dispose()
      fabricCanvasRef.current = null
      artworkObjectRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    setBackgroundImage: async (url: string) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      img.set({
        scaleX: canvas.getWidth() / (img.width || 1),
        scaleY: canvas.getHeight() / (img.height || 1),
        selectable: false,
        evented: false,
      })
      canvas.backgroundImage = img
      canvas.requestRenderAll()
    },
    setArtworkImage: async (url: string) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return
      if (artworkObjectRef.current) {
        canvas.remove(artworkObjectRef.current)
      }
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      img.set({ originX: 'center', originY: 'center', left: canvas.getWidth() / 2, top: canvas.getHeight() / 2 })
      canvas.add(img)
      canvas.setActiveObject(img)
      artworkObjectRef.current = img
      canvas.requestRenderAll()
    },
    getTransform: () => {
      const canvas = fabricCanvasRef.current
      const obj = artworkObjectRef.current
      if (!canvas || !obj) return null
      return {
        offsetXPct: (obj.left ?? 0) / canvas.getWidth(),
        offsetYPct: (obj.top ?? 0) / canvas.getHeight(),
        rotationDeg: obj.angle ?? 0,
      }
    },
    setTransform: (transform: MockupCanvasTransform) => {
      const canvas = fabricCanvasRef.current
      const obj = artworkObjectRef.current
      if (!canvas || !obj) return
      obj.set({
        left: transform.offsetXPct * canvas.getWidth(),
        top: transform.offsetYPct * canvas.getHeight(),
        angle: transform.rotationDeg,
      })
      obj.setCoords()
      canvas.requestRenderAll()
    },
    centerHorizontally: () => {
      const canvas = fabricCanvasRef.current
      const obj = artworkObjectRef.current
      if (!canvas || !obj) return
      canvas.centerObjectH(obj)
      canvas.requestRenderAll()
    },
    centerVertically: () => {
      const canvas = fabricCanvasRef.current
      const obj = artworkObjectRef.current
      if (!canvas || !obj) return
      canvas.centerObjectV(obj)
      canvas.requestRenderAll()
    },
    resetRotation: () => {
      const obj = artworkObjectRef.current
      if (!obj) return
      obj.set({ angle: 0 })
      obj.setCoords()
      fabricCanvasRef.current?.requestRenderAll()
    },
  }))

  return <canvas ref={canvasElRef} width={width} height={height} />
})
