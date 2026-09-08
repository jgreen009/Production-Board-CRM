import { useQuery } from '@tanstack/react-query'
import { getArtworkSignedUrl } from '@/api/artwork'
import type { Artwork } from '@/types'

const PREVIEWABLE_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

// Order Detail's read-only tabs (Artwork & Mockups) get an Order whose
// artwork[].previewUrl is always unset — signed URLs are short-lived and
// generated on demand, never persisted, so a real order's saved images
// need this extra fetch to actually render instead of showing the
// "no preview" file-icon placeholder forever. A failed fetch for one file
// just leaves that file without a preview rather than failing the rest.
export function useArtworkPreviewUrls(artwork: Artwork[]) {
  const previewable = artwork.filter((a) => a.storagePath && PREVIEWABLE_TYPES.includes(a.fileType))

  return useQuery({
    queryKey: ['artwork-preview-urls', previewable.map((a) => a.id).sort()],
    queryFn: async () => {
      const entries = await Promise.all(
        previewable.map(async (a) => {
          try {
            const url = await getArtworkSignedUrl(a.storagePath!)
            return [a.id, url] as const
          } catch {
            return [a.id, undefined] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, string | undefined>
    },
    enabled: previewable.length > 0,
  })
}
