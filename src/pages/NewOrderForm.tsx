import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Order } from '@/types'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { useUpdateOrderWithActivity, useUpsertOrder, useOrderFormValues } from '@/hooks/useOrders'
import { useActiveStaff } from '@/hooks/useStaff'
import { useToast } from '@/components/ui/toast-context'
import { staffErrorMessage } from '@/utils/errorMessage'
import { Button } from '@/components/ui/Button'
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

interface OrderFormEditorProps {
  // Present for edit-active and resume-draft — absent for a brand-new order.
  orderId?: string
  initialValues?: OrderFormValues
  // Only used (and only needed) in edit-active mode, for the activity diff.
  previousOrder?: Order
  mode?: OrderFormMode
}

// The actual form — reused as-is by /orders/new (mode: create, or
// resume-draft via the ?draft= query param below), EditOrderForm (mode:
// edit-active), and ResumeDraftForm. One form, three entry points, per
// spec §11 (no second editing system) extended to cover drafts the same
// way (Milestone 11).
export function OrderFormEditor({ orderId: existingOrderId, initialValues, previousOrder, mode = 'create' }: OrderFormEditorProps) {
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

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialValues ?? defaultOrderFormValues(),
    mode: 'onSubmit',
  })

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

    const runSave = (values: OrderFormValues) => {
      if (savingRef.current) return
      savingRef.current = true
      setAutosaveState('saving')
      upsertOrder.mutate(
        { values, orderId: orderIdRef.current, finalize: false },
        {
          onSuccess: (id) => {
            orderIdRef.current = id
            setOrderId(id)
            setAutosaveState('saved')
          },
          onError: () => setAutosaveState('error'),
          onSettled: () => {
            savingRef.current = false
          },
        },
      )
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
    const id = await upsertOrder.mutateAsync({ values: methods.getValues(), orderId: null, finalize: false })
    orderIdRef.current = id
    setOrderId(id)
    return id
  }

  const handleSaveDraft = () => {
    const values = methods.getValues()
    if (!values.jobName?.trim()) {
      showToast('Enter a name before saving a draft.', 'info')
      return
    }
    setAutosaveState('saving')
    upsertOrder.mutate(
      { values, orderId: orderIdRef.current, finalize: false, generatePreviews: true },
      {
        onSuccess: (id) => {
          orderIdRef.current = id
          setOrderId(id)
          setAutosaveState('saved')
          showToast('Draft saved.', 'success')
        },
        onError: (err) => {
          setAutosaveState('error')
          showToast(staffErrorMessage(err, 'Failed to save draft'), 'info')
        },
      },
    )
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
        const id = await upsertOrder.mutateAsync({ values, orderId: orderIdRef.current, finalize: true, generatePreviews: true })
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

  const submitting = isEditingActive ? updateOrderWithActivity.isPending : upsertOrder.isPending
  const heading = isEditingActive ? 'Edit Order' : mode === 'resume-draft' ? 'Resume Draft' : 'New Order'
  const description = isEditingActive
    ? "Update this order's production specification."
    : mode === 'resume-draft'
      ? 'Pick up where you left off — this draft autosaves in the background again as you go.'
      : 'Digital production specification for a new SALT PRINTS job.'

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
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
export default function NewOrderForm() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft') ?? undefined
  const { data: draftValues, isLoading } = useOrderFormValues(draftId)

  if (draftId && isLoading) {
    return <p className="p-4 text-sm text-zinc-400">Loading draft...</p>
  }

  if (draftId && draftValues) {
    return <OrderFormEditor orderId={draftId} initialValues={draftValues} mode="resume-draft" />
  }

  return <OrderFormEditor mode="create" />
}
