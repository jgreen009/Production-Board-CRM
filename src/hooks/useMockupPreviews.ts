import { useQuery } from '@tanstack/react-query'
import { getMockupPreviewSignedUrl } from '@/api/mockupPreviews'

// Batch B: centralized signed-URL access for saved mockup previews — every
// read-only surface (Order Detail, Production Board, Quick View) goes
// through these hooks rather than calling Supabase Storage directly.
// Deliberately mirrors useArtwork.ts's pattern (short-lived signed URLs,
// never persisted, refetchable via ordinary React Query staleness/refetch
// rather than treated as canonical state).
//
// Batch C — signed-URL request findings (see Batch C handover's "signed
// URL findings" section for the full write-up): a page rendering N order
// rows with N distinct previewStoragePath values issues N separate
// requests here (one per row) — React Query dedupes by exact query key
// so a re-render never repeats an in-flight/cached one, but the initial
// mount still fans out N parallel requests. That per-row pattern itself
// is left alone this batch (a real batching fix would mean MockupThumbnail
// stops self-fetching and instead receives a pre-resolved URL from a
// parent that calls useMockupPreviewUrls once — a bigger refactor of a
// component shared by four surfaces, deferred per the batch's own
// "no premature complex optimization" instruction). What IS a genuine,
// low-risk, one-line fix: mockupPreviews.ts signs URLs for a full hour
// (SIGNED_URL_EXPIRY_SECONDS), but neither hook set a `staleTime`, so
// React Query's default (0) meant every remount or window refocus
// re-requested a brand new signed URL even when the cached one had
// nearly an hour of validity left. staleTime below is set safely under
// that expiry so a cached URL is reused for its practical lifetime
// instead of being needlessly re-signed.
const SIGNED_URL_STALE_TIME_MS = 55 * 60 * 1000

export function useMockupPreviewUrl(storagePath: string | undefined | null) {
  return useQuery({
    queryKey: ['mockup-preview-url', storagePath],
    queryFn: () => getMockupPreviewSignedUrl(storagePath!),
    enabled: !!storagePath,
    staleTime: SIGNED_URL_STALE_TIME_MS,
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
    staleTime: SIGNED_URL_STALE_TIME_MS,
  })
}
