import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Order } from '@/types'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { useUpdateOrderWithActivity, useUpsertOrder } from '@/hooks/useOrders'
import { useToast } from '@/components/ui/toast-context'
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

interface NewOrderFormProps {
  // Present only when editing an already-active order (from EditOrderForm,
  // Milestone 8) — same form, same upsert_order RPC underneath (spec §11:
  // no second editing system), but background autosave is deliberately
  // off in this mode (see below) and the save path logs activity for
  // whatever changed.
  editOrderId?: string
  initialValues?: OrderFormValues
  previousOrder?: Order
}

export default function NewOrderForm({ editOrderId, initialValues, previousOrder }: NewOrderFormProps) {
  const isEditMode = !!editOrderId
  const navigate = useNavigate()
  const { showToast } = useToast()
  const upsertOrder = useUpsertOrder()
  const updateOrderWithActivity = useUpdateOrderWithActivity()

  const [orderId, setOrderId] = useState<string | null>(editOrderId ?? null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const orderIdRef = useRef<string | null>(editOrderId ?? null)
  const savingRef = useRef(false)

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialValues ?? defaultOrderFormValues(),
    mode: 'onSubmit',
  })

  // Background autosave — new orders only. Deliberately off when editing:
  // this order is already Active and potentially visible to other staff
  // right now (Production Board, Orders List), and a mid-edit intermediate
  // state (e.g. a garment briefly removed before its replacement is added)
  // going out via the whole-child-set-replace RPC is a real risk a Draft
  // never has (nothing looks at a Draft until it's finalized). Editing an
  // active order is explicit Save Changes only.
  useEffect(() => {
    if (isEditMode) return
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
  }, [isEditMode])

  const handleSaveDraft = () => {
    const values = methods.getValues()
    if (!values.jobName?.trim()) {
      showToast('Enter a name before saving a draft.', 'info')
      return
    }
    setAutosaveState('saving')
    upsertOrder.mutate(
      { values, orderId: orderIdRef.current, finalize: false },
      {
        onSuccess: (id) => {
          orderIdRef.current = id
          setOrderId(id)
          setAutosaveState('saved')
          showToast('Draft saved.', 'success')
        },
        onError: (err) => {
          setAutosaveState('error')
          showToast(err instanceof Error ? err.message : 'Failed to save draft', 'info')
        },
      },
    )
  }

  const onSubmit = async (values: OrderFormValues) => {
    try {
      if (isEditMode && previousOrder) {
        const id = await updateOrderWithActivity.mutateAsync({ values, orderId: editOrderId!, previous: previousOrder })
        showToast('Order updated', 'success')
        navigate(`/orders/${id}`)
      } else {
        const id = await upsertOrder.mutateAsync({ values, orderId: orderIdRef.current, finalize: true })
        showToast('Order created', 'success')
        navigate(`/orders/${id}`)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'save changes' : 'create order'}`, 'info')
    }
  }

  const onInvalid = () => {
    showToast('Please fix the highlighted fields before saving.', 'info')
  }

  const submitting = isEditMode ? updateOrderWithActivity.isPending : upsertOrder.isPending

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{isEditMode ? 'Edit Order' : 'New Order'}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isEditMode
                ? 'Update this order\'s production specification.'
                : 'Digital production specification for a new SALT PRINTS job.'}
              {!isEditMode && autosaveState === 'saving' && ' Saving draft...'}
              {!isEditMode && autosaveState === 'saved' && ' Draft saved.'}
              {!isEditMode && autosaveState === 'error' && ' Couldn’t save draft — check your connection.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isEditMode && (
              <Button type="button" variant="secondary" onClick={handleSaveDraft}>
                Save Draft
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={submitting}>
              {isEditMode ? (submitting ? 'Saving...' : 'Save Changes') : submitting ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <CustomerJobSection />
            <TurnaroundDeliverySection />
            <ServicesSection />
            <GarmentStylesSection orderId={orderId} />
            <PaymentAndNotesSection />
          </div>

          <div className="lg:sticky lg:top-20 lg:h-fit">
            <OrderSummary
              values={methods.watch()}
              submitting={submitting}
              submitLabel={isEditMode ? 'Save Changes' : 'Create Order'}
              productionStatus={previousOrder?.productionStatus}
            />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
