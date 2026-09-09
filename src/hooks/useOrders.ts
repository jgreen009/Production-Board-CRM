import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOrder,
  getOrderFormValues,
  listActivityForOrder,
  listDraftOrders,
  listOrders,
  listPrintSpecIds,
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
import { useToast } from '@/components/ui/toast-context'

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
  /**
   * Batch B: generate/refresh mockup preview PNGs after this save succeeds.
   * Deliberately opt-in and false by default — the periodic background
   * autosave (Phase 2) calls this same mutation on every debounced form
   * change, which is exactly the "drag/resize/position-change" category
   * Batch B says must NOT trigger preview generation. Only an explicit
   * user action (Save Draft, Create Order) passes true.
   */
  generatePreviews?: boolean
}

interface UpsertOrderContext {
  previousPrintSpecIds: string[]
}

async function syncPreviewsAfterSave(
  orderId: string,
  values: OrderFormValues,
  previousPrintSpecIds: string[],
  queryClient: ReturnType<typeof useQueryClient>,
  showToast: ReturnType<typeof useToast>['showToast'],
) {
  try {
    const { syncMockupPreviewsForOrder } = await import('@/api/mockupPreviewSync')
    const result = await syncMockupPreviewsForOrder({
      orderId,
      printSpecs: values.printSpecs,
      artworkFiles: values.artworkFiles,
      garments: values.garments,
      previousPrintSpecIds,
    })
    queryClient.invalidateQueries({ queryKey: ['orders', orderId] })
    queryClient.invalidateQueries({ queryKey: ['mockup-preview-url'] })
    queryClient.invalidateQueries({ queryKey: ['mockup-preview-urls'] })
    if (result.failed > 0) {
      showToast('Order saved, but one or more mockup previews could not be updated.', 'info')
    }
  } catch (err) {
    // Per the Batch B failure boundary: the order itself already saved
    // successfully by the time this runs — a preview failure is reported,
    // never treated as the save having failed.
    console.error('Mockup preview sync failed', err)
    showToast('Order saved, but mockup previews could not be updated.', 'info')
  }
}

// The one write path behind Save Draft, background autosave, and Create
// Order alike (spec §11) — every call just wraps the same upsert_order RPC.
export function useUpsertOrder() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation<string, Error, UpsertOrderInput, UpsertOrderContext>({
    mutationFn: ({ values, orderId, finalize }) => upsertOrder(values, orderId, finalize),
    onMutate: async ({ orderId }) => ({
      previousPrintSpecIds: orderId ? await listPrintSpecIds(orderId).catch(() => []) : [],
    }),
    onSuccess: (id, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', id] })
      if (!variables.generatePreviews) return
      void syncPreviewsAfterSave(id, variables.values, context?.previousPrintSpecIds ?? [], queryClient, showToast)
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
// status) relative to the order as it was when the edit form loaded. Always
// explicit (Phase 2 never autosaves an active order), so mockup previews
// are always synced here, no opt-in flag needed.
export function useUpdateOrderWithActivity() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  return useMutation({
    mutationFn: ({ values, orderId, previous }: UpdateOrderWithActivityInput) =>
      updateOrderWithActivity(orderId, values, previous),
    onSuccess: (id, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', id] })
      queryClient.invalidateQueries({ queryKey: ['orders', id, 'activity'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const previousPrintSpecIds = variables.previous.printSpecs.map((p) => p.id)
      void syncPreviewsAfterSave(id, variables.values, previousPrintSpecIds, queryClient, showToast)
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
