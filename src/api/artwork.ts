import { supabase } from '@/lib/supabase'
import type { Artwork } from '@/types'
import { mapArtworkRowToDomain } from '@/api/mappers/artwork'
import type { ArtworkRow } from '@/api/mappers/artwork'
import { validateArtworkFile } from '@/utils/artworkValidation'

const BUCKET = 'artwork-originals'
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 // 1 hour — plenty for a preview render, never persisted

export async function listArtworkForOrder(orderId: string): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from('artwork')
    .select('id, file_name, file_type, file_size_bytes, storage_path, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ArtworkRow[]).map(mapArtworkRowToDomain)
}

// Insert-row-first-then-upload (deliberate order, per the plan): if the
// storage upload fails, the just-inserted row is deleted, so the only
// possible inconsistent state is "a row with no file" — trivially
// detectable (signed URL 404s) — rather than an orphaned storage object
// with no row pointing at it, which is invisible to the app and silently
// piles up.
export async function uploadArtwork(orderId: string, file: File): Promise<Artwork & { storagePath: string }> {
  const validation = validateArtworkFile(file)
  if (!validation.valid) throw new Error(validation.reason)

  const artworkId = crypto.randomUUID()
  const storagePath = `orders/${orderId}/artwork/${artworkId}/${file.name}`

  const { data: userData } = await supabase.auth.getUser()

  const { data: row, error: insertError } = await supabase
    .from('artwork')
    .insert({
      id: artworkId,
      order_id: orderId,
      file_name: file.name,
      file_type: validation.fileType,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: userData.user?.id,
    })
    .select('id, file_name, file_type, file_size_bytes, storage_path, created_at')
    .single()
  if (insertError) throw insertError

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  })

  if (uploadError) {
    await supabase.from('artwork').delete().eq('id', artworkId)
    throw uploadError
  }

  return { ...mapArtworkRowToDomain(row as ArtworkRow), storagePath }
}

export async function removeArtwork(artworkId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) throw storageError

  const { error: deleteError } = await supabase.from('artwork').delete().eq('id', artworkId)
  if (deleteError) throw deleteError
}

// Never persisted anywhere (not in the DB, not in a long-lived cache) —
// storage_path is the only canonical value; a signed URL is generated on
// demand, short expiry, every time a preview is actually rendered.
export async function getArtworkSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)
  if (error) throw error
  return data.signedUrl
}

// Phase 4 Milestone 5 (Reorder) — artwork is exclusively order-owned (the
// Storage path itself embeds order_id, confirmed during Phase 4 planning),
// so a reordered job can never reference the original artwork row or
// Storage object. This copies both: a live smoke test (staff-authenticated
// client, real Supabase project) confirmed `supabase.storage.from(bucket)
// .copy()` works under the EXISTING artwork-originals policies — no new
// Storage policy or trusted server-side mechanism was needed for this.
//
// Insert-row-after-copy (same deliberate ordering as uploadArtwork): if
// the DB insert fails after a successful Storage copy, the copied object
// is removed so no orphaned Storage object is left behind pointing at
// nothing. The original artwork row and Storage object are never written
// to at any point in this function.
export async function copyArtworkForReorder(sourceArtworkId: string, newOrderId: string): Promise<Artwork & { storagePath: string }> {
  const { data: source, error: fetchError } = await supabase
    .from('artwork')
    .select('file_name, file_type, mime_type, file_size_bytes, storage_path')
    .eq('id', sourceArtworkId)
    .single()
  if (fetchError) throw fetchError

  const newArtworkId = crypto.randomUUID()
  const newStoragePath = `orders/${newOrderId}/artwork/${newArtworkId}/${source.file_name}`

  const { error: copyError } = await supabase.storage.from(BUCKET).copy(source.storage_path, newStoragePath)
  if (copyError) throw copyError

  const { data: userData } = await supabase.auth.getUser()
  const { data: row, error: insertError } = await supabase
    .from('artwork')
    .insert({
      id: newArtworkId,
      order_id: newOrderId,
      file_name: source.file_name,
      file_type: source.file_type,
      mime_type: source.mime_type,
      file_size_bytes: source.file_size_bytes,
      storage_path: newStoragePath,
      uploaded_by: userData.user?.id,
    })
    .select('id, file_name, file_type, file_size_bytes, storage_path, created_at')
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([newStoragePath]).catch(() => {})
    throw insertError
  }

  return { ...mapArtworkRowToDomain(row as ArtworkRow), storagePath: newStoragePath }
}

// Copies only the artwork files actually REFERENCED by the copied
// PrintSpecs — a source order's other, unused uploads are deliberately
// left behind, not blindly duplicated (Phase 4 plan's "only copy required
// artwork" decision). Two PrintSpecs sharing the same source artwork are
// deduplicated to exactly one new artwork row, both remapped to it — the
// mapping is by artwork UUID only, never by filename (two files can share
// a name). Returns the new artworkFiles list (for display) and the
// PrintSpecs with artworkId rewritten to the new ids; a PrintSpec whose
// source artwork couldn't be resolved (or had none) simply ends up with
// artworkId undefined rather than a dangling reference.
export async function copyReferencedArtworkForReorder(
  newOrderId: string,
  artworkFiles: { id: string }[],
  printSpecs: { artworkId?: string }[],
): Promise<{
  artworkFiles: { id: string; fileName: string; fileType: string; sizeKb: number; storagePath: string; previewUrl: undefined }[]
  artworkIdMap: Map<string, string>
}> {
  const knownIds = new Set(artworkFiles.map((f) => f.id))
  const referencedIds = [...new Set(printSpecs.map((s) => s.artworkId).filter((id): id is string => !!id && knownIds.has(id)))]

  const artworkIdMap = new Map<string, string>()
  const newArtworkFiles: { id: string; fileName: string; fileType: string; sizeKb: number; storagePath: string; previewUrl: undefined }[] = []

  for (const oldId of referencedIds) {
    const copied = await copyArtworkForReorder(oldId, newOrderId)
    artworkIdMap.set(oldId, copied.id)
    newArtworkFiles.push({
      id: copied.id,
      fileName: copied.fileName,
      fileType: copied.fileType,
      sizeKb: copied.sizeKb,
      storagePath: copied.storagePath,
      previewUrl: undefined,
    })
  }

  return { artworkFiles: newArtworkFiles, artworkIdMap }
}
