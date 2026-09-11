// Mockup System V2 Batch A — the single aspect-ratio-preserving fit
// algorithm shared by MockupCanvas.tsx, GarmentMockup.tsx, and
// mockupPreviewRenderer.ts (audit §7-8: the old code let each of these
// independently stretch a garment photo's width and height to fill a
// fixed canvas, distorting anatomy). No renderer may compute this itself —
// see MOCKUP_SYSTEM_V2_BATCH_A_HANDOVER.md "Renderer unification".

export interface FitResult {
  /** Top-left of the fitted source within the target viewport (letterbox/pillarbox offset). */
  x: number
  y: number
  /** Fitted source size within the target viewport, aspect-ratio preserved. */
  width: number
  height: number
  /** Uniform scale factor applied to both axes — never separate scaleX/scaleY. */
  scale: number
}

// "Contain" fit: the largest the source can render at inside the target
// box without exceeding it on either axis, uniformly scaled (never
// independent X/Y), then centered. Degenerates safely to a 1:1, top-left
// placement if either dimension is non-positive (e.g. an image that hasn't
// finished loading) rather than dividing by zero.
export function fitGarmentIntoViewport(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): FitResult {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight, scale: 1 }
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height, scale }
}

export interface CanonicalRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportRect {
  x: number
  y: number
  width: number
  height: number
}

// Maps a rect defined in the same coordinate space as the fit's `source`
// dimensions (i.e. a garment's canonical viewBox units — see
// config/garmentGeometry.ts) into on-screen/on-canvas viewport pixels.
export function mapCanonicalRectToViewport(rect: CanonicalRect, fit: FitResult): ViewportRect {
  return {
    x: fit.x + rect.x * fit.scale,
    y: fit.y + rect.y * fit.scale,
    width: rect.width * fit.scale,
    height: rect.height * fit.scale,
  }
}

export interface CanonicalPoint {
  x: number
  y: number
}

export interface ViewportPoint {
  x: number
  y: number
}

export function mapCanonicalPointToViewport(point: CanonicalPoint, fit: FitResult): ViewportPoint {
  return { x: fit.x + point.x * fit.scale, y: fit.y + point.y * fit.scale }
}
