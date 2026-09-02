import type { Order } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Shirt } from 'lucide-react'
import { garmentSizeBreakdown, garmentTotal } from '@/utils/quantity'

export function GarmentsTab({ order }: { order: Order }) {
  if (order.garments.length === 0) {
    return <EmptyState icon={Shirt} title="No garments on this order" />
  }

  return (
    <div className="flex flex-col gap-2">
      {order.garments.map((g) => (
        <Card key={g.id}>
          <CardBody className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                {g.brand} {g.type} — {g.colour}
              </p>
              <p className="text-xs text-zinc-500">{garmentSizeBreakdown(g) || 'No sizes recorded'}</p>
            </div>
            <span className="text-sm font-semibold text-zinc-700">Total {garmentTotal(g)}</span>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
