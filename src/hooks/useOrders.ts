import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOrder,
  getOrderFormValues,
  listActivityForOrder,
  listDraftOrders,
  listOrders,
  listRecentActivity,
  updateArtworkStatus,
  updateGarmentStatus,
  updateOrderWithActivity,
  updatePaymentStatus,
  updateProductionStatus,
  upsertOrder,
} from '@/api/orders'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { ArtworkStatus, GarmentStatus, Order, PaymentStatus, ProductionStatus } from '@/types'

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: listOrders })
}

// The drafts view (Milestone 11) — ['orders', 'drafts'] rather than
// ['orders'] itself (that key is Active-only everywhere else), but still
// covered by every existing invalidateQueries({ queryKey: ['orders'] })
// call throughout, since TanStack Query invalidates by array-key prefix.
export function useDraftOrders() {
  return useQuery({ queryKey: ['orders', 'drafts'], queryFn: listDraftOrders })
}

// Prefixed with 'dashboard' so the existing invalidateQueries({ queryKey:
// ['dashboard'] }) calls in every status mutation's onSettled (Milestone 7)
// already cover this — TanStack Query invalidates by key prefix.
export function useRecentActivity(limit: number) {
  return useQuery({ queryKey: ['dashboard', 'recent-activity', limit], queryFn: () => listRecentActivity(limit) })
}

export function useOrder(id: string | undefined | null) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  })
}

// Edit Order (Milestone 8) and, later, resuming a draft (Milestone 11) —
// the reverse mapping needed to hydrate the New Order form from an
// existing row. Separate query key from ['orders', id] since it returns a
// different shape (OrderFormValues, not Order) and is only ever needed
// once, on mount, not kept live like the detail view.
export function useOrderFormValues(id: string | undefined | null) {
  return useQuery({
    queryKey: ['orders', id, 'form-values'],
    queryFn: () => getOrderFormValues(id!),
    enabled: !!id,
    staleTime: Infinity, // a stale background refetch would clobber in-progress edits
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

interface UpdateOrderWithActivityInput {
  values: OrderFormValues
  orderId: string
  previous: Order
}

// Edit Order's save path — finalizes via the same upsert_order RPC, then
// logs activity for whatever meaningfully changed (priority, payment
// status) relative to the order as it was when the edit form loaded.
export function useUpdateOrderWithActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values, orderId, previous }: UpdateOrderWithActivityInput) =>
      updateOrderWithActivity(orderId, values, previous),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', id] })
      queryClient.invalidateQueries({ queryKey: ['orders', id, 'activity'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
