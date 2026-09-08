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
  }
}

export function sortPrintSpecRows<T extends { sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order)
}

// Form -> RPC payload shape for one printSpecs[] entry. Field names already
// match the jsonb keys upsert_order reads (see supabase/migrations/
// ..._order_core.sql) — this only exists so the mapping is named,
// unit-tested, and in one place rather than inlined at the call site.
export function mapPrintSpecFormToPayload(spec: PrintSpecFormValues) {
  return {
    position: spec.position,
    colour: spec.colour,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    garmentType: spec.garmentType,
    garmentColour: spec.garmentColour,
    artworkId: spec.artworkId,
    offsetX: spec.offsetX ?? 0,
    offsetY: spec.offsetY ?? 0,
  }
}
