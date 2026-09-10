import type { ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusSelect } from '@/components/domain/StatusSelect'
import { AssigneeSelector } from '@/components/domain/AssigneeSelector'
import { ProductionTimeline } from '@/components/domain/ProductionTimeline'
import { PAYMENT_STATUSES, ARTWORK_STATUSES, GARMENT_STATUSES, PRODUCTION_STATUSES } from '@/data/mockStatuses'
import {
  useUpdateArtworkStatus,
  useUpdateGarmentStatus,
  useUpdateOrderAssignment,
  useUpdatePaymentStatus,
  useUpdateProductionStatus,
} from '@/hooks/useOrders'
import { useActiveStaff } from '@/hooks/useStaff'
import { useToast } from '@/components/ui/toast-context'
import { staffErrorMessage } from '@/utils/errorMessage'
import { getAttentionWarnings, getProductionBlockers, isReadyForProduction } from '@/utils/productionReadiness'

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
  const updateAssignment = useUpdateOrderAssignment()
  const { data: activeStaff = [] } = useActiveStaff()

  const onError = (err: unknown) => showToast(staffErrorMessage(err, 'Failed to update status'), 'info')
  const hint = isRealOrder ? undefined : 'Demo order — status changes here aren\'t saved'

  const ready = isReadyForProduction(order)
  const blockers = getProductionBlockers(order)
  const warnings = getAttentionWarnings(order)

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

        <StatusBlock
          label="Assigned To"
          hint={hint}
          control={
            <AssigneeSelector
              value={order.assignedTo}
              currentAssigneeName={order.assignedToName}
              currentAssigneeActive={order.assignedToActive}
              onChange={(id) => {
                if (!isRealOrder) return
                const assigneeName = id ? (activeStaff.find((s) => s.id === id)?.fullName ?? null) : null
                updateAssignment.mutate(
                  { orderId: order.id, assignedTo: id ?? null, assigneeName, previousAssigneeName: order.assignedToName ?? null },
                  { onError },
                )
              }}
            />
          }
        />

        <Card className={`col-span-2 p-3 ${ready ? 'border-emerald-200 bg-emerald-50/50' : 'border-zinc-200'}`}>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">Ready for Production</p>
          {ready ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={14} /> Yes
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-sm font-medium text-zinc-600">
              <XCircle size={14} className="mt-0.5 shrink-0 text-zinc-400" />
              No — {blockers.join(', ') || 'check status'}
            </p>
          )}
          {warnings.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {warnings.map((w) => (
                <p
                  key={w.message}
                  className={
                    w.severity === 'critical'
                      ? 'text-[11px] font-medium text-red-600'
                      : w.severity === 'warning'
                        ? 'text-[11px] font-medium text-amber-600'
                        : 'text-[11px] text-zinc-500'
                  }
                >
                  ⚠ {w.message}
                </p>
              ))}
            </div>
          )}
        </Card>
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
