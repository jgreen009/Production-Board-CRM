import type { Artwork, ArtworkFileType } from '@/types'

export interface ArtworkRow {
  id: string
  file_name: string
  file_type: string
  file_size_bytes: number
  storage_path: string
  created_at: string
}

// `previewUrl` is deliberately left unset here — it's a short-lived signed
// URL, never persisted, generated on demand by getArtworkSignedUrl(), given
// `storagePath` (which this mapper does carry through, specifically so a
// component that needs one has something to call that with — see
// useArtworkPreviewUrls).
export function mapArtworkRowToDomain(row: ArtworkRow): Artwork {
  return {
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type as ArtworkFileType,
    sizeKb: Math.round(row.file_size_bytes / 1024),
    uploadedAt: row.created_at,
    storagePath: row.storage_path,
  }
}
