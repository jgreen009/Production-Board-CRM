import type { ReactNode } from 'react'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { mockCustomers } from '@/data/mockCustomers'
import { orderSubTotal } from '@/utils/quantity'
import { formatDate } from '@/utils/date'
import type { GarmentItem } from '@/types'

interface OrderSummaryProps {
  values: OrderFormValues
  nextOrderNumber: string
  submitting?: boolean
}

export function OrderSummary({ values, nextOrderNumber, submitting }: OrderSummaryProps) {
  const customer = mockCustomers.find((c) => c.id === values.customerId)
  const customerLabel = customer ? customer.name : values.newCustomerName || 'Not selected'

  const subTotal = orderSubTotal(
    values.garments.map(
      (g) =>
        ({
          id: g.id,
          type: g.type,
          brand: g.brand,
          colour: g.colour,
          sizing: g.sizing,
          adultQuantities: g.adultQuantities,
          youthQuantities: g.youthQuantities,
        }) as GarmentItem,
    ),
  )

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-800">Order Summary</h2>
        <p className="text-xs text-zinc-400">Next order number: {nextOrderNumber}</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 text-sm">
        <SummaryRow label="Customer" value={customerLabel} />
        <SummaryRow label="Due" value={values.dueDate ? formatDate(values.dueDate) : '—'} />
        <SummaryRow label="Turnaround" value={<StatusBadge kind="turnaround" value={values.turnaround} />} />
        <SummaryRow label="Priority" value={<StatusBadge kind="priority" value={values.priority} />} />
        <SummaryRow label="Garments" value={`${values.garments.length} type${values.garments.length === 1 ? '' : 's'}`} />
        <SummaryRow label="Sub Total (qty)" value={subTotal} />
        <SummaryRow
          label="Services"
          value={values.services.length ? values.services.join(', ') : 'None selected'}
        />
        <SummaryRow label="Artwork" value={`${values.artworkFiles.length} file${values.artworkFiles.length === 1 ? '' : 's'}`} />
        <SummaryRow label="Est. Production Status" value={<StatusBadge kind="production" value="New" />} />

        <div className="border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
          100% deposit required before manufacturing commences. Quotes, invoices, and screens are valid for
          3 weeks. 25 units is the minimum order for screen printing (special pricing available under
          minimum). Standard turnaround time is 5–10 working days.
        </div>

        <Button type="submit" variant="primary" disabled={submitting} className="mt-1 w-full">
          {submitting ? 'Creating Order...' : 'Create Order'}
        </Button>
      </CardBody>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span className="text-right font-medium text-zinc-800">{value}</span>
    </div>
  )
}
