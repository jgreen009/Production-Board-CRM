import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrder, listOrders, upsertOrder } from '@/api/orders'
import type { OrderFormValues } from '@/schemas/orderFormSchema'

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: listOrders })
}

export function useOrder(id: string | undefined | null) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  })
}

interface UpsertOrderInput {
  values: OrderFormValues
  orderId: string | null
  finalize: boolean
}

// The one write path behind Save Draft, background autosave, and Create
// Order alike (spec §11) — every call just wraps the same upsert_order RPC.
export function useUpsertOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values, orderId, finalize }: UpsertOrderInput) => upsertOrder(values, orderId, finalize),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', id] })
    },
  })
}
