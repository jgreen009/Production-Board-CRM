import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { useUpsertOrder } from '@/hooks/useOrders'
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

export default function NewOrderForm() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const upsertOrder = useUpsertOrder()

  const [orderId, setOrderId] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const orderIdRef = useRef<string | null>(null)
  const savingRef = useRef(false)

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultOrderFormValues(),
    mode: 'onSubmit',
  })

  // Background autosave: creates the draft on first meaningful input
  // (jobName non-empty), then keeps it saved as a Draft in the background
  // as the user keeps filling out the form — per the agreed design, this
  // is never surfaced as an active production order (Production
  // Board/dashboards/Orders List all filter on order_state = 'Active')
  // until Create Order explicitly finalizes it.
  useEffect(() => {
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
  }, [])

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
      const id = await upsertOrder.mutateAsync({ values, orderId: orderIdRef.current, finalize: true })
      showToast('Order created', 'success')
      navigate(`/orders/${id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create order', 'info')
    }
  }

  const onInvalid = () => {
    showToast('Please fix the highlighted fields before creating the order.', 'info')
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">New Order</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Digital production specification for a new SALT PRINTS job.
              {autosaveState === 'saving' && ' Saving draft...'}
              {autosaveState === 'saved' && ' Draft saved.'}
              {autosaveState === 'error' && ' Couldn’t save draft — check your connection.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button type="submit" variant="primary" disabled={upsertOrder.isPending}>
              {upsertOrder.isPending ? 'Creating...' : 'Create Order'}
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
            <OrderSummary values={methods.watch()} submitting={upsertOrder.isPending} />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
