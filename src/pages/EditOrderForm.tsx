import { useParams } from 'react-router-dom'
import { useOrder, useOrderFormValues } from '@/hooks/useOrders'
import { isRealOrderId } from '@/utils/id'
import NewOrderForm from '@/pages/NewOrderForm'
import NotFound from '@/pages/NotFound'

// Reuses NewOrderForm entirely (spec §11: no second editing system) — this
// page's only job is fetching the order two ways (as an Order, for the
// activity-diff snapshot; as OrderFormValues, to hydrate the form) and
// handing both to it once loaded. Mock demo orders (mockOrders.ts) can't
// be edited this way — there's no real row underneath them — so a
// non-uuid id here goes straight to Not Found rather than a broken form.
export default function EditOrderForm() {
  const { id } = useParams()
  const isReal = isRealOrderId(id)

  const { data: order, isLoading: orderLoading } = useOrder(isReal ? id : undefined)
  const { data: formValues, isLoading: formValuesLoading } = useOrderFormValues(isReal ? id : undefined)

  if (!isReal) return <NotFound />
  if (orderLoading || formValuesLoading) {
    return <p className="p-4 text-sm text-zinc-400">Loading order...</p>
  }
  if (!order || !formValues) return <NotFound />

  return <NewOrderForm editOrderId={order.id} initialValues={formValues} previousOrder={order} />
}
