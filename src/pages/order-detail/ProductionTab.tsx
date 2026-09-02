import type { ReactNode } from 'react'
import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { ProductionTimeline } from '@/components/domain/ProductionTimeline'

export function ProductionTab({ order }: { order: Order }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <StatusBlock label="Payment" badge={<StatusBadge kind="payment" value={order.paymentStatus} />} />
        <StatusBlock label="Artwork" badge={<StatusBadge kind="artwork" value={order.artworkStatus} />} />
        <StatusBlock label="Garments" badge={<StatusBadge kind="garment" value={order.garmentStatus} />} />
        <StatusBlock label="Production" badge={<StatusBadge kind="production" value={order.productionStatus} />} />
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Timeline</h3>
        </CardHeader>
        <CardBody>
          <ProductionTimeline order={order} />
        </CardBody>
      </Card>
    </div>
  )
}

function StatusBlock({ label, badge }: { label: string; badge: ReactNode }) {
  return (
    <Card className="p-3">
      <p className="mb-1.5 text-xs font-medium text-zinc-400">{label}</p>
      {badge}
    </Card>
  )
}
