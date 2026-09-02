import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { buildOrderFromForm } from '@/pages/new-order/buildOrder'
import { addOrder } from '@/data/orderStore'
import { mockOrders } from '@/data/mockOrders'
import { nextOrderNumber } from '@/utils/id'
import { useToast } from '@/components/ui/toast-context'
import { Button } from '@/components/ui/Button'
import { OrderSummary } from '@/components/domain/OrderSummary'
import { CustomerJobSection } from '@/pages/new-order/sections/CustomerJobSection'
import { TurnaroundDeliverySection } from '@/pages/new-order/sections/TurnaroundDeliverySection'
import { ServicesSection } from '@/pages/new-order/sections/ServicesSection'
import { GarmentsSection } from '@/pages/new-order/sections/GarmentsSection'
import { ArtworkSection } from '@/pages/new-order/sections/ArtworkSection'
import { MockupSection } from '@/pages/new-order/sections/MockupSection'
import { PrintDetailsSection } from '@/pages/new-order/sections/PrintDetailsSection'
import { PaymentAndNotesSection } from '@/pages/new-order/sections/PaymentAndNotesSection'

export default function NewOrderForm() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultOrderFormValues(),
    mode: 'onSubmit',
  })

  const orderNumberPreview = nextOrderNumber(mockOrders.map((o) => o.orderNumber))

  const onSubmit = (values: OrderFormValues) => {
    setSubmitting(true)
    const order = buildOrderFromForm(values)
    addOrder(order)
    setSubmitting(false)
    showToast(`Order ${order.orderNumber} created`, 'success')
    navigate(`/orders/${order.id}`)
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
              Digital production specification for a new SALT PRINTS job. Next order number:{' '}
              <span className="font-medium text-zinc-700">{orderNumberPreview}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => showToast('Draft saved for this session.', 'info')}
            >
              Save Draft
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <CustomerJobSection />
            <TurnaroundDeliverySection />
            <ServicesSection />
            <GarmentsSection />
            <ArtworkSection />
            <MockupSection />
            <PrintDetailsSection />
            <PaymentAndNotesSection />
          </div>

          <div className="lg:sticky lg:top-20 lg:h-fit">
            <OrderSummary values={methods.watch()} nextOrderNumber={orderNumberPreview} submitting={submitting} />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
