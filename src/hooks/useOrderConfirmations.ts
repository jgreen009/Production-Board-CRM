import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listConfirmationRecords, reconcileOrderConfirmation } from '@/api/orderConfirmations'

export const CONFIRMATIONS_QUERY_KEY = ['order-confirmations'] as const

export function useConfirmationRecords() {
  return useQuery({ queryKey: CONFIRMATIONS_QUERY_KEY, queryFn: listConfirmationRecords })
}

export function useReconcileConfirmation(orderId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => reconcileOrderConfirmation(orderId!),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CONFIRMATIONS_QUERY_KEY }),
  })
}
