import type { ReactNode } from 'react'
import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusSelect } from '@/components/domain/StatusSelect'
import { ProductionTimeline } from '@/components/domain/ProductionTimeline'
import { PAYMENT_STATUSES, ARTWORK_STATUSES, GARMENT_STATUSES, PRODUCTION_STATUSES } from '@/data/mockStatuses'
import {
  useUpdateArtworkStatus,
  useUpdateGarmentStatus,
  useUpdatePaymentStatus,
  useUpdateProductionStatus,
} from '@/hooks/useOrders'
import { useToast } from '@/components/ui/toast-context'

interface ProductionTabProps {
  order: Order
  isRealOrder: boolean
}

export function ProductionTab({ order, isRealOrder }: ProductionTabProps) {
  const { showToast } = useToast()
  const updateProduction = useUpdateProductionStatus()
  const updateArtwork = useUpdateArtworkStatus()
  const updateGarment = useUpdateGarmentStatus()
  const updatePayment = useUpdatePaymentStatus()

  const onError = (err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to update status', 'info')
  const hint = isRealOrder ? undefined : 'Demo order — status changes here aren\'t saved'

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <StatusBlock
          label="Payment"
          hint={hint}
          control={
            <StatusSelect
              value={order.paymentStatus}
              options={PAYMENT_STATUSES}
              onChange={(status) => {
                if (!isRealOrder) return
                updatePayment.mutate({ orderId: order.id, status }, { onError })
              }}
            />
          }
        />
        <StatusBlock
          label="Artwork"
          hint={hint}
          control={
            <StatusSelect
              value={order.artworkStatus}
              options={ARTWORK_STATUSES}
              onChange={(status) => {
                if (!isRealOrder) return
                updateArtwork.mutate({ orderId: order.id, status }, { onError })
              }}
            />
          }
        />
        <StatusBlock
          label="Garments"
          hint={hint}
          control={
            <StatusSelect
              value={order.garmentStatus}
              options={GARMENT_STATUSES}
              onChange={(status) => {
                if (!isRealOrder) return
                updateGarment.mutate({ orderId: order.id, status }, { onError })
              }}
            />
          }
        />
        <StatusBlock
          label="Production"
          hint={hint}
          control={
            <StatusSelect
              value={order.productionStatus}
              options={PRODUCTION_STATUSES}
              onChange={(status) => {
                if (!isRealOrder) return
                updateProduction.mutate({ orderId: order.id, status }, { onError })
              }}
            />
          }
        />
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

function StatusBlock({ label, control, hint }: { label: string; control: ReactNode; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="mb-1.5 text-xs font-medium text-zinc-400">{label}</p>
      {control}
      {hint && <p className="mt-1.5 text-[11px] text-zinc-400">{hint}</p>}
    </Card>
  )
}
