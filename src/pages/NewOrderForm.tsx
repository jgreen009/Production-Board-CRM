import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Order } from '@/types'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { buildReorderFormValues } from '@/pages/new-order/reorder'
import { useUpdateOrderWithActivity, useUpsertOrder, useOrder, useOrderFormValues } from '@/hooks/useOrders'
import { useActiveStaff } from '@/hooks/useStaff'
import { logReorderActivity } from '@/api/orders'
import { copyReferencedArtworkForReorder } from '@/api/artwork'
import { useToast } from '@/components/ui/toast-context'
import { staffErrorMessage } from '@/utils/errorMessage'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderSummary } from '@/components/domain/OrderSummary'
import { CustomerJobSection } from '@/pages/new-order/sections/CustomerJobSection'
import { TurnaroundDeliverySection } from '@/pages/new-order/sections/TurnaroundDeliverySection'
import { ServicesSection } from '@/pages/new-order/sections/ServicesSection'
import { GarmentStylesSection } from '@/pages/new-order/sections/GarmentStylesSection'
import { PaymentAndNotesSection } from '@/pages/new-order/sections/PaymentAndNotesSection'

// Debounce for background autosave once a draft already exists — the very
// first save (on first meaningful input) fires immediately instead, so a
// draft row (and therefore an order_id for artwork to attach to) exists as
// soon as reasonably possible rather than after a multi-second wait.
const AUTOSAVE_DEBOUNCE_MS = 1500

export type OrderFormMode = 'create' | 'edit-active' | 'resume-draft'

interface ReorderSource {
  orderId: string
  orderNumber: string
}

interface OrderFormEditorProps {
  // Present for edit-active and resume-draft — absent for a brand-new order.
  orderId?: string
  initialValues?: OrderFormValues
  // Only used (and only needed) in edit-active mode, for the activity diff.
  previousOrder?: Order
  mode?: OrderFormMode
  // Phase 4 Milestone 5 — present only when this "create" is a Reorder.
  // Drives the source banner and the one-time artwork-copy step on first save.
  reorderFrom?: ReorderSource
}

// The actual form — reused as-is by /orders/new (mode: create, or
// resume-draft via the ?draft= query param below), EditOrderForm (mode:
// edit-active), and ResumeDraftForm. One form, three entry points, per
// spec §11 (no second editing system) extended to cover drafts the same
// way (Milestone 11).
export function OrderFormEditor({ orderId: existingOrderId, initialValues, previousOrder, mode = 'create', reorderFrom }: OrderFormEditorProps) {
  const isEditingActive = mode === 'edit-active'
  const navigate = useNavigate()
  const { showToast } = useToast()
  const upsertOrder = useUpsertOrder()
  const updateOrderWithActivity = useUpdateOrderWithActivity()
  const { data: activeStaff = [] } = useActiveStaff()

  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const orderIdRef = useRef<string | null>(existingOrderId ?? null)
  const savingRef = useRef(false)
  // Guards the one-time artwork-copy step below so it can only ever fire
  // once per mount, regardless of which of the three save entry points
  // (autosave, ensureOrderId, Save Draft, Create Order) happens to be the
  // one that actually triggers the reordered form's first real save.
  const reorderArtworkCopiedRef = useRef(false)
  // True for the whole reorder-artwork-copy span (two upsertOrder calls
  // plus the Storage copy step between them) — upsertOrder.isPending alone
  // goes false in the gap between those two calls, which would otherwise
  // let a double-click sneak a second save in while the copy is running.
  const [reorderCopyInFlight, setReorderCopyInFlight] = useState(false)

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialValues ?? defaultOrderFormValues(),
    mode: 'onSubmit',
  })

  // The ONE save path every entry point below (autosave, ensureOrderId,
  // Save Draft, Create Order) goes through — never a second one. For a
  // normal order this is just upsertOrder. For a Reorder's very first
  // save (orderId still null), it additionally: creates the new order
  // shell with every copied PrintSpec's artworkId stripped (so no row
  // ever persists, even momentarily, referencing the SOURCE order's
  // artwork — Phase 4 audit: artwork is exclusively order-owned); copies
  // only the artwork actually referenced by the copied PrintSpecs into
  // the new order (deduplicated — two specs sharing one source artwork
  // become one new artwork row, see copyReferencedArtworkForReorder);
  // reflects the remapped ids back into the form so every later save
  // (and the UI) sees only the new order's own real artwork; logs the
  // reorder-source activity; then performs the real save the caller
  // actually asked for. reorderArtworkCopiedRef guarantees this whole
  // block runs at most once per mount, however it's first triggered.
  const performSave = async (values: OrderFormValues, finalize: boolean, generatePreviews?: boolean): Promise<string> => {
    const needsReorderArtworkCopy = !!reorderFrom && !orderIdRef.current && !reorderArtworkCopiedRef.current
    if (!needsReorderArtworkCopy) {
      return upsertOrder.mutateAsync({ values, orderId: orderIdRef.current, finalize, generatePreviews })
    }

    reorderArtworkCopiedRef.current = true
    setReorderCopyInFlight(true)
    try {
      const shellId = await upsertOrder.mutateAsync({
        values: { ...values, printSpecs: values.printSpecs.map((s) => ({ ...s, artworkId: undefined })), artworkFiles: [] },
        orderId: null,
        finalize: false,
      })
      orderIdRef.current = shellId
      setOrderId(shellId)

      const { artworkFiles: newArtworkFiles, artworkIdMap } = await copyReferencedArtworkForReorder(
        shellId,
        values.artworkFiles,
        values.printSpecs,
      )
      const remappedPrintSpecs = values.printSpecs.map((s) => ({
        ...s,
        artworkId: s.artworkId ? artworkIdMap.get(s.artworkId) : undefined,
      }))
      const remappedValues: OrderFormValues = { ...values, artworkFiles: newArtworkFiles, printSpecs: remappedPrintSpecs }

      methods.setValue('artworkFiles', remappedValues.artworkFiles)
      methods.setValue('printSpecs', remappedValues.printSpecs)

      await logReorderActivity(shellId, reorderFrom!.orderNumber)

      return await upsertOrder.mutateAsync({ values: remappedValues, orderId: shellId, finalize, generatePreviews })
    } finally {
      setReorderCopyInFlight(false)
    }
  }

  // Background autosave — create and resume-draft only (a Draft row,
  // whether brand new or being resumed, is invisible everywhere until
  // finalized, so autosaving it is safe). Deliberately off for
  // edit-active: that order is already Active and potentially visible to
  // other staff right now (Production Board, Orders List), and a mid-edit
  // intermediate state (e.g. a garment briefly removed before its
  // replacement is added) going out via the whole-child-set-replace RPC
  // is a real risk a Draft never has. Editing an active order is explicit
  // Save Changes only.
  useEffect(() => {
    if (isEditingActive) return
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const runSave = async (values: OrderFormValues) => {
      if (savingRef.current) return
      savingRef.current = true
      setAutosaveState('saving')
      try {
        await performSave(values, false)
        setAutosaveState('saved')
      } catch {
        setAutosaveState('error')
      } finally {
        savingRef.current = false
      }
    }

    const subscription = methods.watch((values) => {
      if (!values.jobName?.trim()) return
      const delay = orderIdRef.current ? AUTOSAVE_DEBOUNCE_MS : 0
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => runSave(values as OrderFormValues), delay)
    })

    return () => {
      subscription.unsubscribe()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingActive])

  // Lets ArtworkSection open the upload flow immediately regardless of
  // what else has (or hasn't) been filled in yet — no field in this form
  // blocks another. Silently creates the draft row on demand (same
  // upsert_order RPC, same orderId state) the first time a file is
  // actually selected, whatever the rest of the form currently holds;
  // required-field validation only ever runs at Create Order / Save
  // Changes, never here.
  const ensureOrderId = async (): Promise<string> => {
    if (orderIdRef.current) return orderIdRef.current
    return performSave(methods.getValues(), false)
  }

  const handleSaveDraft = async () => {
    const values = methods.getValues()
    if (!values.jobName?.trim()) {
      showToast('Enter a name before saving a draft.', 'info')
      return
    }
    setAutosaveState('saving')
    try {
      await performSave(values, false, true)
      setAutosaveState('saved')
      showToast('Draft saved.', 'success')
    } catch (err) {
      setAutosaveState('error')
      showToast(staffErrorMessage(err, 'Failed to save draft'), 'info')
    }
  }

  const onSubmit = async (values: OrderFormValues) => {
    try {
      if (isEditingActive && previousOrder) {
        const newAssigneeName = values.assignedTo
          ? (activeStaff.find((s) => s.id === values.assignedTo)?.fullName ?? null)
          : null
        const id = await updateOrderWithActivity.mutateAsync({
          values,
          orderId: existingOrderId!,
          previous: previousOrder,
          newAssigneeName,
        })
        showToast('Order updated', 'success')
        navigate(`/orders/${id}`)
      } else {
        const id = await performSave(values, true, true)
        showToast('Order created', 'success')
        navigate(`/orders/${id}`)
      }
    } catch (err) {
      showToast(staffErrorMessage(err, `Failed to ${isEditingActive ? 'save changes' : 'create order'}`), 'info')
    }
  }

  const onInvalid = () => {
    showToast('Please fix the highlighted fields before saving.', 'info')
  }

  const submitting = isEditingActive ? updateOrderWithActivity.isPending : upsertOrder.isPending || reorderCopyInFlight
  const heading = isEditingActive ? 'Edit Order' : mode === 'resume-draft' ? 'Resume Draft' : 'New Order'
  const description = isEditingActive
    ? "Update this order's production specification."
    : mode === 'resume-draft'
      ? 'Pick up where you left off — this draft autosaves in the background again as you go.'
      : 'Digital production specification for a new SALT PRINTS job.'

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
        {reorderFrom && (
          <Card className="mb-4 flex flex-col gap-2 border-indigo-200 bg-indigo-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-sm text-indigo-800">
              <RefreshCw size={14} /> Reorder from <span className="font-medium">{reorderFrom.orderNumber}</span> — review before saving.
            </p>
            <Link
              to="/customers"
              className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900"
            >
              <ArrowLeft size={12} /> Cancel Reorder
            </Link>
          </Card>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{heading}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {description}
              {!isEditingActive && autosaveState === 'saving' && ' Saving draft...'}
              {!isEditingActive && autosaveState === 'saved' && ' Draft saved.'}
              {!isEditingActive && autosaveState === 'error' && ' Couldn’t save draft — check your connection.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isEditingActive && (
              <Button type="button" variant="secondary" onClick={handleSaveDraft}>
                Save Draft
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={submitting}>
              {isEditingActive ? (submitting ? 'Saving...' : 'Save Changes') : submitting ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <CustomerJobSection />
            <TurnaroundDeliverySection />
            <ServicesSection />
            <GarmentStylesSection orderId={orderId} ensureOrderId={ensureOrderId} />
            <PaymentAndNotesSection
              currentAssigneeName={previousOrder?.assignedToName}
              currentAssigneeActive={previousOrder?.assignedToActive}
            />
          </div>

          <div className="lg:sticky lg:top-20 lg:h-fit">
            <OrderSummary
              values={methods.watch()}
              submitting={submitting}
              submitLabel={isEditingActive ? 'Save Changes' : 'Create Order'}
              productionStatus={previousOrder?.productionStatus}
            />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

// Route-level wrapper for /orders/new. Plain new order by default; if a
// ?draft=<id> query param is present (from the Drafts tab on Orders List,
// or the URL Save Draft could round-trip through in future), fetches and
// hydrates that draft instead — same OrderFormEditor, resume-draft mode.
//
// Phase 4 Milestone 5 — ?reorderFrom=<id> follows the exact same pattern
// (a plain URL param, not router state carrying the whole order) so a
// refresh before the first save just re-fetches and rebuilds instead of
// losing the reorder entirely — the same resilience ?draft= already gives
// resume-draft. Nothing is written to the database merely by opening this
// URL; buildReorderFormValues is pure, and the first actual write only
// happens on the reordered form's first real save (see performSave above).
export default function NewOrderForm() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft') ?? undefined
  const reorderFromId = searchParams.get('reorderFrom') ?? undefined
  const { data: draftValues, isLoading: draftLoading } = useOrderFormValues(draftId)
  const { data: reorderSourceOrder, isLoading: reorderOrderLoading } = useOrder(reorderFromId)
  const { data: reorderSourceValues, isLoading: reorderValuesLoading } = useOrderFormValues(reorderFromId)

  if (draftId && draftLoading) {
    return <p className="p-4 text-sm text-zinc-400">Loading draft...</p>
  }

  if (draftId && draftValues) {
    return <OrderFormEditor orderId={draftId} initialValues={draftValues} mode="resume-draft" />
  }

  if (reorderFromId) {
    if (reorderOrderLoading || reorderValuesLoading) {
      return <p className="p-4 text-sm text-zinc-400">Preparing reorder...</p>
    }
    if (!reorderSourceOrder || !reorderSourceValues) {
      return (
        <EmptyState
          title="Couldn't load the order to reorder"
          description="It may have been removed, or the link is out of date."
          action={<Link to="/customers" className="text-sm font-medium text-zinc-700 hover:underline">Back to Customers</Link>}
        />
      )
    }
    return (
      <OrderFormEditor
        mode="create"
        initialValues={buildReorderFormValues(reorderSourceValues)}
        reorderFrom={{ orderId: reorderSourceOrder.id, orderNumber: reorderSourceOrder.orderNumber }}
      />
    )
  }

  return <OrderFormEditor mode="create" />
}
