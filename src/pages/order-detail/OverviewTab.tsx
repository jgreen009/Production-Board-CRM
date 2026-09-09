import type { ReactNode } from 'react'
import { CheckCircle2, Mail, Phone } from 'lucide-react'
import type { Order } from '@/types'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { MockupThumbnail } from '@/components/domain/MockupThumbnail'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { formatDate } from '@/utils/date'
import { getAttentionWarnings, getProductionBlockers, isReadyForProduction } from '@/utils/productionReadiness'

export function OverviewTab({ order }: { order: Order }) {
  const ready = isReadyForProduction(order)
  const blockers = getProductionBlockers(order)
  const warnings = getAttentionWarnings(order)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {(warnings.length > 0 || !ready) && (
        <Card className="lg:col-span-3 border-l-4 border-l-amber-400">
          <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {ready ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={15} /> Ready for Production
                </span>
              ) : (
                <span className="text-sm font-medium text-zinc-700">
                  Not ready for production — {blockers.join(', ') || 'check status'}
                </span>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {warnings.map((w) => (
                  <span
                    key={w.message}
                    className={
                      w.severity === 'critical'
                        ? 'text-xs font-medium text-red-600'
                        : w.severity === 'warning'
                          ? 'text-xs font-medium text-amber-600'
                          : 'text-xs text-zinc-500'
                    }
                  >
                    ⚠ {w.message}
                  </span>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Customer & Dates</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Customer" value={order.customer} />
          <Field label="Email" value={<span className="flex items-center gap-1.5"><Mail size={13} className="text-zinc-400" />{order.email}</span>} />
          <Field label="Phone" value={<span className="flex items-center gap-1.5"><Phone size={13} className="text-zinc-400" />{order.phone}</span>} />
          <Field label="Order Created" value={formatDate(order.createdAt)} />
          <Field label="Due Date" value={formatDate(order.dueDate)} />
          <Field label="Turnaround" value={<StatusBadge kind="turnaround" value={order.turnaroundType} />} />
          <Field label="Delivery Method" value={order.deliveryMethod} />
          <Field label="Rush Fee" value={order.rushFee ? 'Yes' : 'No'} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Mockup Preview</h3>
        </CardHeader>
        <CardBody className="flex items-center justify-center">
          <MockupThumbnail mockups={order.printSpecs} size={120} />
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Status</h3>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <StatusBadge kind="payment" value={order.paymentStatus} />
          <StatusBadge kind="artwork" value={order.artworkStatus} />
          <StatusBadge kind="garment" value={order.garmentStatus} />
          <StatusBadge kind="production" value={order.productionStatus} />
          <StatusBadge kind="priority" value={order.priority} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Services</h3>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-1.5">
          {order.services.length ? (
            order.services.map((s) => (
              <span key={s.name} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                {s.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-zinc-400">No services recorded.</p>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Production Notes</h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-zinc-600">{order.productionNotes || 'No production notes recorded.'}</p>
        </CardBody>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="font-medium text-zinc-800">{value}</p>
    </div>
  )
}
