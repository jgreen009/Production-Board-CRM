import { supabase } from '@/lib/supabase'
import { getPrintZone } from '@/config/printZones'
import type { GarmentType, PrintPosition } from '@/types'
import type { ArtworkFileFormValues, PrintSpecFormValues } from '@/schemas/orderFormSchema'
import { BUCKET, mockupPreviewStoragePath } from '@/api/mockupPreviews'

// Batch B — the Fabric-using preview generation/sync path, deliberately
// kept in its own module separate from mockupPreviews.ts's read-oriented
// exports (signed URLs, integrity check). This file is imported ONLY via
// `await import(...)` from the order-save mutation hooks (useOrders.ts) —
// never statically — so read-only surfaces that statically import
// mockupPreviews.ts never pull this file (or the Fabric renderer it
// dynamically imports) into their bundle. Splitting it out fixed a real
// Vite "ineffective dynamic import" warning: mockupPreviews.ts used to
// contain both, which meant its static importers (the read-only hooks)
// forced the whole module — sync logic included — into the main chunk.

const PREVIEWABLE_ARTWORK_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

async function uploadMockupPreview(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true, // overwrite the same canonical path — no version history
  })
  if (error) throw error
}

async function deleteMockupPreview(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

async function updatePrintSpecPreviewPath(printSpecId: string, path: string): Promise<void> {
  // Plain update, not through upsert_order — mirrors how artwork.storage_path
  // is written outside the RPC, since this happens strictly after the order
  // save has already succeeded (see the failure-boundary note below).
  const { error } = await supabase.from('print_specs').update({ preview_storage_path: path }).eq('id', printSpecId)
  if (error) throw error
}

export interface SyncMockupPreviewsParams {
  orderId: string
  printSpecs: PrintSpecFormValues[]
  artworkFiles: ArtworkFileFormValues[]
  garments: { type: string }[]
  /** print_specs.id values that existed for this order before this save — used to clean up removed specs' previews. */
  previousPrintSpecIds: string[]
}

export interface SyncMockupPreviewsResult {
  succeeded: number
  failed: number
}

function effectiveGarmentType(spec: PrintSpecFormValues, garments: { type: string }[]): GarmentType {
  return (spec.garmentType || garments[0]?.type || 'T-shirt') as GarmentType
}

// Batch B strategy (documented, deliberate — per plan's own allowance):
// regenerate every current PrintSpec's preview on every explicit save,
// rather than diffing which canvas-affecting fields actually changed.
// Acceptable for a small per-order spec count; the canonical path is
// stable and overwritten in place, so regeneration is always safe and
// idempotent even when nothing actually changed. Called ONLY from an
// explicit save success handler (Save Draft, Create Order, Save Changes)
// — never from the periodic autosave — per the "generate only on explicit
// save" requirement.
//
// Failure boundary: order persistence already succeeded by the time this
// runs (it's only ever called from a save mutation's onSuccess). A failure
// anywhere in here is caught per-PrintSpec and reported back as a count,
// never thrown back into the save flow — the caller decides how to surface
// it (a toast), and it can never undo or block the already-saved order.
export async function syncMockupPreviewsForOrder({
  orderId,
  printSpecs,
  artworkFiles,
  garments,
  previousPrintSpecIds,
}: SyncMockupPreviewsParams): Promise<SyncMockupPreviewsResult> {
  const { renderMockupPreviewPng } = await import('@/utils/mockupPreviewRenderer')

  // Deleted-PrintSpec cleanup — only the generated preview, never the
  // customer's original artwork file (a completely different bucket/table).
  const currentIds = new Set(printSpecs.map((s) => s.id))
  const removedIds = previousPrintSpecIds.filter((id) => !currentIds.has(id))
  await Promise.allSettled(
    removedIds.map((id) =>
      deleteMockupPreview(mockupPreviewStoragePath(orderId, id)).catch((err) => {
        // Best-effort: an object that fails to delete here is caught later
        // by the Storage->DB integrity check as an orphan, not fatal to
        // the (already-succeeded) order save.
        console.error('Could not remove preview for deleted print spec', id, err)
      }),
    ),
  )

  let succeeded = 0
  let failed = 0

  for (const spec of printSpecs) {
    try {
      const artwork = artworkFiles.find((f) => f.id === spec.artworkId)
      const artworkUrl =
        artwork && PREVIEWABLE_ARTWORK_TYPES.includes(artwork.fileType) ? artwork.previewUrl : undefined
      const zone = getPrintZone(spec.position as PrintPosition)

      const blob = await renderMockupPreviewPng({
        garmentType: effectiveGarmentType(spec, garments),
        garmentColour: spec.garmentColour || '',
        view: zone.view,
        zone,
        artworkUrl,
        offsetX: spec.offsetX ?? 0,
        offsetY: spec.offsetY ?? 0,
        rotationDeg: spec.rotationDeg ?? 0,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
      })

      const path = mockupPreviewStoragePath(orderId, spec.id)
      // Upload/overwrite first, update the DB path only after that
      // succeeds — the canonical path is unchanged either way, so a failed
      // upload leaves the previous (still-valid) preview and DB reference
      // exactly as they were.
      await uploadMockupPreview(path, blob)
      await updatePrintSpecPreviewPath(spec.id, path)
      succeeded++
    } catch (err) {
      console.error('Mockup preview generation failed for print spec', spec.id, err)
      failed++
    }
  }

  return { succeeded, failed }
}
