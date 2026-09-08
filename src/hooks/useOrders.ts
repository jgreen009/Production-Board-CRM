import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOrder,
  listActivityForOrder,
  listOrders,
  updateArtworkStatus,
  updateGarmentStatus,
  updatePaymentStatus,
  updateProductionStatus,
  upsertOrder,
} from '@/api/orders'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { ArtworkStatus, GarmentStatus, Order, PaymentStatus, ProductionStatus } from '@/types'

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

export function useOrderActivity(orderId: string | undefined | null) {
  return useQuery({
    queryKey: ['orders', orderId, 'activity'],
    queryFn: () => listActivityForOrder(orderId!),
    enabled: !!orderId,
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

interface StatusMutationContext {
  previousList?: Order[]
  previousDetail?: Order
}

// Shared optimistic pattern (plan §9): onMutate patches both the list and
// detail cache entries immediately and snapshots the previous values,
// onError rolls back to that snapshot, onSettled invalidates everything
// that could disagree (list, detail, its activity feed, dashboard) so
// Production Board / Order Detail / Orders List / Dashboard converge —
// the exact failure mode HANDOVER.md flagged in the old local-state code.
function useOptimisticStatusField<S extends string>(
  field: keyof Order,
  mutationFn: (orderId: string, status: S) => Promise<void>,
) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { orderId: string; status: S }, StatusMutationContext>({
    mutationFn: ({ orderId, status }) => mutationFn(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] })
      await queryClient.cancelQueries({ queryKey: ['orders', orderId] })

      const previousList = queryClient.getQueryData<Order[]>(['orders'])
      const previousDetail = queryClient.getQueryData<Order>(['orders', orderId])

      queryClient.setQueryData<Order[]>(['orders'], (old) =>
        old?.map((o) => (o.id === orderId ? { ...o, [field]: status } : o)),
      )
      queryClient.setQueryData<Order>(['orders', orderId], (old) => (old ? { ...old, [field]: status } : old))

      return { previousList, previousDetail }
    },
    onError: (_err, { orderId }, context) => {
      if (context?.previousList) queryClient.setQueryData(['orders'], context.previousList)
      if (context?.previousDetail) queryClient.setQueryData(['orders', orderId], context.previousDetail)
    },
    onSettled: (_data, _err, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'activity'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateProductionStatus() {
  return useOptimisticStatusField<ProductionStatus>('productionStatus', updateProductionStatus)
}

export function useUpdateArtworkStatus() {
  return useOptimisticStatusField<ArtworkStatus>('artworkStatus', updateArtworkStatus)
}

export function useUpdateGarmentStatus() {
  return useOptimisticStatusField<GarmentStatus>('garmentStatus', updateGarmentStatus)
}

export function useUpdatePaymentStatus() {
  return useOptimisticStatusField<PaymentStatus>('paymentStatus', updatePaymentStatus)
}
