import type { GarmentType, PrintPosition, PrintSpec } from '@/types'
import type { PrintSpecFormValues } from '@/schemas/orderFormSchema'

export interface PrintSpecRow {
  id: string
  position: string
  colour: string
  width_mm: number
  height_mm: number
  garment_type: string | null
  garment_colour: string | null
  artwork_id: string | null
  offset_x: number | null
  offset_y: number | null
  sort_order: number
  rotation_deg: number
  preview_storage_path: string | null
  approval_note: string | null
}

export function mapPrintSpecRowToDomain(row: PrintSpecRow): PrintSpec {
  return {
    id: row.id,
    position: row.position as PrintPosition,
    colour: row.colour,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    garmentType: row.garment_type ? (row.garment_type as GarmentType) : undefined,
    garmentColour: row.garment_colour ?? undefined,
    artworkId: row.artwork_id ?? undefined,
    offsetX: row.offset_x ?? undefined,
    offsetY: row.offset_y ?? undefined,
    rotationDeg: row.rotation_deg,
    previewStoragePath: row.preview_storage_path ?? undefined,
    approvalNote: row.approval_note ?? undefined,
  }
}

export function sortPrintSpecRows<T extends { sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order)
}

// Batch B — Production Board's thumbnail (and any other single-preview
// surface) picks "the first PrintSpec by sort order that has a generated
// preview", falling back to the first PrintSpec at all so a "no preview
// yet" state still has something to label. `specs` is expected already
// sort_order-ordered (mapDatabaseOrderToDomain already sorts via
// sortPrintSpecRows above), so this is a plain find, not a re-sort.
export function selectPrimaryPrintSpec(specs: PrintSpec[]): PrintSpec | undefined {
  return specs.find((s) => !!s.previewStoragePath) ?? specs[0]
}

// Form -> RPC payload shape for one printSpecs[] entry. Field names already
// match the jsonb keys upsert_order reads (see supabase/migrations/
// ..._order_core.sql) — this only exists so the mapping is named,
// unit-tested, and in one place rather than inlined at the call site.
//
// `id` is included (Phase 3 plan §12a) so upsert_order's whole-child-set
// replace can reinsert this exact row with the same primary key instead of
// generating a fresh one on every save — required for preview_storage_path
// to keep pointing at a valid Storage object across saves. Every id here is
// guaranteed a real UUID from the moment the print spec is created
// client-side (see defaultValues.ts's emptyPrintSpec), so no fallback
// generation is needed on either side.
export function mapPrintSpecFormToPayload(spec: PrintSpecFormValues) {
  return {
    id: spec.id,
    position: spec.position,
    colour: spec.colour,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    garmentType: spec.garmentType,
    garmentColour: spec.garmentColour,
    artworkId: spec.artworkId,
    offsetX: spec.offsetX ?? 0,
    offsetY: spec.offsetY ?? 0,
    rotationDeg: spec.rotationDeg ?? 0,
    approvalNote: spec.approvalNote,
  }
}
