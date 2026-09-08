import type { ArtworkFileType } from '@/types'

export const MAX_ARTWORK_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB, matches the storage bucket's own limit

export const ARTWORK_EXTENSION_MAP: Record<string, ArtworkFileType> = {
  png: 'PNG',
  jpg: 'JPG',
  jpeg: 'JPG',
  webp: 'WEBP',
  svg: 'SVG',
  pdf: 'PDF',
  ai: 'AI',
}

// Expected MIME per extension, where browsers reliably report one — .ai
// files often come through with an empty or non-standard `file.type`, so
// that extension has no entry here and the MIME check is skipped for it.
const EXPECTED_MIME: Partial<Record<ArtworkFileType, string[]>> = {
  PNG: ['image/png'],
  JPG: ['image/jpeg'],
  WEBP: ['image/webp'],
  SVG: ['image/svg+xml'],
  PDF: ['application/pdf'],
}

export interface ArtworkValidationResult {
  valid: boolean
  reason?: string
  fileType?: ArtworkFileType
}

export function validateArtworkFile(file: File): ArtworkValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fileType = ARTWORK_EXTENSION_MAP[ext]

  if (!fileType) {
    return { valid: false, reason: `Unsupported file type ".${ext}" — allowed: PNG, JPG, WEBP, SVG, PDF, AI` }
  }

  if (file.size > MAX_ARTWORK_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { valid: false, reason: `File is ${mb}MB — the limit is 25MB` }
  }

  const expectedMime = EXPECTED_MIME[fileType]
  if (expectedMime && file.type && !expectedMime.includes(file.type)) {
    return { valid: false, reason: `File extension ".${ext}" doesn't match its actual content type` }
  }

  return { valid: true, fileType }
}
