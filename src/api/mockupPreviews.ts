import { supabase } from '@/lib/supabase'

// Read-oriented mockup-preview access — kept deliberately free of the
// Fabric-using render/sync path (see mockupPreviewSync.ts) so that every
// read-only surface (Order Detail, Production Board, Quick View) can
// statically import this module without ever pulling Fabric into the
// bundle they load in. Bucket name/expiry match the pattern already
// established for artwork previews.
export const BUCKET = 'mockup-previews'
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60

// The one canonical path per PrintSpec, per docs/PHASE_3_PLAN.md §13/§17 —
// stable across every save (depends only on order/print-spec ids, both of
// which are now stable per Milestone 1's identity fix). Regeneration always
// overwrites this same object; there is no v2/v3/timestamped variant.
export function mockupPreviewStoragePath(orderId: string, printSpecId: string): string {
  return `orders/${orderId}/print-specs/${printSpecId}/preview.png`
}

export async function getMockupPreviewSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)
  if (error) throw error
  return data.signedUrl
}

// Milestone 1's bidirectional integrity requirement, extended to the
// mockup-previews bucket. Not wired into any UI this batch — a callable
// verification utility, run ad hoc (console/scripts) the same way the
// artwork-originals equivalent was checked during the Phase 2.5 audit.
export interface MockupPreviewIntegrityResult {
  /** print_specs.preview_storage_path values with no matching Storage object. */
  brokenDbReferences: string[]
  /** Storage object paths under mockup-previews/orders/ with no print_specs row referencing them. */
  orphanedStorageObjects: string[]
}

export async function checkMockupPreviewIntegrity(): Promise<MockupPreviewIntegrityResult> {
  const { data: rows, error: rowsError } = await supabase
    .from('print_specs')
    .select('id, preview_storage_path')
    .not('preview_storage_path', 'is', null)
  if (rowsError) throw rowsError

  const referencedPaths = new Set((rows ?? []).map((r) => r.preview_storage_path as string))

  const brokenDbReferences: string[] = []
  for (const path of referencedPaths) {
    const dir = path.slice(0, path.lastIndexOf('/'))
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const { data: listed, error: listError } = await supabase.storage.from(BUCKET).list(dir)
    if (listError || !listed?.some((f) => f.name === fileName)) {
      brokenDbReferences.push(path)
    }
  }

  // Storage->DB direction: walk orders/{orderId}/print-specs/{printSpecId}/preview.png
  const orphanedStorageObjects: string[] = []
  const { data: orderDirs } = await supabase.storage.from(BUCKET).list('orders')
  for (const orderDir of orderDirs ?? []) {
    const { data: specDirs } = await supabase.storage.from(BUCKET).list(`orders/${orderDir.name}/print-specs`)
    for (const specDir of specDirs ?? []) {
      const path = `orders/${orderDir.name}/print-specs/${specDir.name}/preview.png`
      if (!referencedPaths.has(path)) orphanedStorageObjects.push(path)
    }
  }

  return { brokenDbReferences, orphanedStorageObjects }
}
