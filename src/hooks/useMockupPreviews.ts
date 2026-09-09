import { useQuery } from '@tanstack/react-query'
import { getMockupPreviewSignedUrl } from '@/api/mockupPreviews'

// Batch B: centralized signed-URL access for saved mockup previews — every
// read-only surface (Order Detail, Production Board, Quick View) goes
// through these hooks rather than calling Supabase Storage directly.
// Deliberately mirrors useArtwork.ts's pattern (short-lived signed URLs,
// never persisted, refetchable via ordinary React Query staleness/refetch
// rather than treated as canonical state).

export function useMockupPreviewUrl(storagePath: string | undefined | null) {
  return useQuery({
    queryKey: ['mockup-preview-url', storagePath],
    queryFn: () => getMockupPreviewSignedUrl(storagePath!),
    enabled: !!storagePath,
  })
}

// For a surface showing several previews at once (Order Detail's Artwork &
// Mockups tab) — one query, one signed-URL fetch per path, a failed
// individual fetch just leaves that one preview without a URL rather than
// failing the rest (same resilience pattern as useArtworkPreviewUrls).
export function useMockupPreviewUrls(storagePaths: (string | undefined | null)[]) {
  const valid = storagePaths.filter((p): p is string => !!p)

  return useQuery({
    queryKey: ['mockup-preview-urls', [...valid].sort()],
    queryFn: async () => {
      const entries = await Promise.all(
        valid.map(async (path) => {
          try {
            return [path, await getMockupPreviewSignedUrl(path)] as const
          } catch {
            return [path, undefined] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<string, string | undefined>
    },
    enabled: valid.length > 0,
  })
}
