import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPublicOrderLink,
  getOrCreateGeneralOrderLink,
  listPublicOrderLinks,
  regenerateGeneralOrderLink,
  revokePublicOrderLink,
} from '@/api/publicOrderLinks'
import type { CreatePublicOrderLinkInput, PublicOrderLink } from '@/api/publicOrderLinks'

export function usePublicOrderLinks() {
  return useQuery({ queryKey: ['public-order-links'], queryFn: listPublicOrderLinks })
}

export function useCreatePublicOrderLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePublicOrderLinkInput) => createPublicOrderLink(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-order-links'] }),
  })
}

export function useRevokePublicOrderLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokePublicOrderLink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-order-links'] }),
  })
}

// The one general (persistent, unlimited-use) link — auto-created the
// first time anything asks for it. Any component anywhere in the app can
// use this same hook to get/display/copy it; React Query's cache means
// only the first caller actually triggers the get-or-create round trip.
export function useGeneralOrderLink() {
  return useQuery({ queryKey: ['public-order-links', 'general'], queryFn: getOrCreateGeneralOrderLink })
}

export function useRegenerateGeneralOrderLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (current: PublicOrderLink) => regenerateGeneralOrderLink(current.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-order-links'] })
    },
  })
}
