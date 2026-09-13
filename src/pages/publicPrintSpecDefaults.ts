import type { GarmentType } from '@/types'
import { getSupportedPrintPositions } from '@/config/garmentGeometry'
import type { PublicPrintSpecFormValues } from '@/schemas/publicOrderFormSchema'

export function emptyPublicPrintSpec(garmentType: string, garmentColour: string): PublicPrintSpecFormValues {
  const defaultPosition = getSupportedPrintPositions(garmentType as GarmentType)[0]?.position ?? 'Left Chest'
  return {
    id: crypto.randomUUID(),
    position: defaultPosition,
    garmentType,
    garmentColour,
    widthMm: 210,
    heightMm: 210,
    colour: '',
    artworkFileId: null,
  }
}

export interface EnsureDefaultPrintSpecResult {
  printSpecs: PublicPrintSpecFormValues[]
  activeSpecId: string
  changed: boolean
}

// Pure — the "GarmentPreview must be visible by default" rule (no reveal
// button/toggle anywhere) boiled down to one testable decision: as soon as
// a garment type is known and there is no print location yet, seed one so
// the preview has something to render immediately. Returns `changed:
// false` (same specs/activeId passed in) when nothing needs to happen, so
// a caller can skip a state update entirely rather than re-render for no
// reason.
export function ensureDefaultPrintSpec(
  printSpecs: PublicPrintSpecFormValues[],
  garmentType: string,
  garmentColour: string,
  currentActiveSpecId: string,
): EnsureDefaultPrintSpecResult {
  if (!garmentType || printSpecs.length > 0) {
    return { printSpecs, activeSpecId: currentActiveSpecId, changed: false }
  }
  const spec = emptyPublicPrintSpec(garmentType, garmentColour)
  return { printSpecs: [spec], activeSpecId: spec.id, changed: true }
}

// Pure — keeps every print location's snapshotted garmentType/garmentColour
// in sync with the customer's first garment entry (the same "garments
// section is the single source of truth for what the mockup preview
// shows" rule the staff Mockup Studio already follows — see
// MockupStudio.tsx's identical comment), AND normalizes each spec's
// position to the new garment's own default whenever the previously-held
// position is no longer valid for it (Mockup System V2 non-upper-body
// extension — e.g. switching T-shirt -> Shorts replaces a stale "Left
// Chest" with "Left Leg" rather than leaving the form holding an invalid
// position). Returns the identical array reference when nothing actually
// changed, so a caller can skip a state update via a simple
// reference-equality check.
export function syncPrintSpecsToEffectiveGarment(
  printSpecs: PublicPrintSpecFormValues[],
  effectiveGarmentType: string,
  effectiveColour: string,
): PublicPrintSpecFormValues[] {
  const supported = getSupportedPrintPositions(effectiveGarmentType as GarmentType)
  const supportedSet = new Set<string>(supported.map((p) => p.position))
  const defaultPosition = supported[0]?.position

  const needsSync = printSpecs.some(
    (p) => p.garmentType !== effectiveGarmentType || p.garmentColour !== effectiveColour || !supportedSet.has(p.position),
  )
  if (!needsSync) return printSpecs

  return printSpecs.map((p) => ({
    ...p,
    garmentType: effectiveGarmentType,
    garmentColour: effectiveColour,
    position: supportedSet.has(p.position) ? p.position : (defaultPosition ?? p.position),
  }))
}
