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
