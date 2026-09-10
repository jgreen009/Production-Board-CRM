import type { Order } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Shirt } from 'lucide-react'
import { garmentSizeBreakdown, garmentTotal } from '@/utils/quantity'

export function GarmentsTab({ order }: { order: Order }) {
  if (order.garments.length === 0) {
    return <EmptyState icon={Shirt} title="No garments on this order" />
  }

  const grandTotal = order.garments.reduce((sum, g) => sum + garmentTotal(g), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {order.garments.map((g) => (
          <Card key={g.id}>
            <CardBody className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                <Shirt size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-800">
                  {g.brand} {g.type} — {g.colour}
                </p>
                <p className="text-xs text-zinc-500">{garmentSizeBreakdown(g) || 'No sizes recorded'}</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-700">
                {garmentTotal(g)}
              </span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="border-l-4 border-l-zinc-300">
        <CardBody className="flex items-center justify-between py-3">
          <span className="text-sm font-medium text-zinc-500">Total Garments</span>
          <span className="text-lg font-semibold text-zinc-900">{grandTotal}</span>
        </CardBody>
      </Card>
    </div>
  )
}
