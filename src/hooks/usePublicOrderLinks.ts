import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPublicOrderLink, listPublicOrderLinks, revokePublicOrderLink } from '@/api/publicOrderLinks'
import type { CreatePublicOrderLinkInput } from '@/api/publicOrderLinks'

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
