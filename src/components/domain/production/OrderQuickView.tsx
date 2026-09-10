import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Mail, Phone } from 'lucide-react'
import { clsx } from 'clsx'
import type { Order } from '@/types'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { MockupThumbnail } from '@/components/domain/MockupThumbnail'
import { formatDate, isDueToday, isOverdue } from '@/utils/date'
import { getAttentionWarnings, getProductionBlockers, isReadyForProduction } from '@/utils/productionReadiness'

interface OrderQuickViewProps {
  order: Order | null
  onClose: () => void
}

export function OrderQuickView({ order, onClose }: OrderQuickViewProps) {
  const navigate = useNavigate()

  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order?.jobName ?? ''}
      subtitle={order?.orderNumber}
      footer={
        order && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}/edit`)}>
              Edit
            </Button>
            <Button variant="primary" onClick={() => navigate(`/orders/${order.id}`)}>
              Open Full Order
            </Button>
          </div>
        )
      }
    >
      {order && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <MockupThumbnail mockups={order.printSpecs} size={56} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-800">{order.customer}</p>
              <p className="flex items-center gap-1 text-xs text-zinc-400"><Phone size={12} /> {order.phone}</p>
              <p className="flex items-center gap-1 text-xs text-zinc-400"><Mail size={12} /> {order.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-400">Quantity</dt>
              <dd className="font-medium text-zinc-800">{order.quantity}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Due Date</dt>
              <dd
                className={clsx(
                  'font-semibold',
                  isOverdue(order.dueDate)
                    ? 'text-danger'
                    : isDueToday(order.dueDate)
                      ? 'text-warning'
                      : 'text-zinc-800',
                )}
              >
                {formatDate(order.dueDate)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-zinc-500">STATUS</p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge kind="priority" value={order.priority} />
              <StatusBadge kind="production" value={order.productionStatus} />
              <StatusBadge kind="artwork" value={order.artworkStatus} />
              <StatusBadge kind="garment" value={order.garmentStatus} />
              <StatusBadge kind="payment" value={order.paymentStatus} />
            </div>
          </div>

          {isReadyForProduction(order) ? (
            <div className="flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 size={14} /> Ready for Production
            </div>
          ) : (
            getProductionBlockers(order).length > 0 && (
              <div className="rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500">
                Not ready — {getProductionBlockers(order).join(', ')}
              </div>
            )
          )}

          {getAttentionWarnings(order).length > 0 && (
            <div className="flex flex-col gap-1 rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-2">
              {getAttentionWarnings(order).map((w) => (
                <p
                  key={w.message}
                  className={clsx(
                    'flex items-start gap-1.5 text-xs',
                    w.severity === 'critical'
                      ? 'font-medium text-danger'
                      : w.severity === 'warning'
                        ? 'font-medium text-warning'
                        : 'text-zinc-500',
                  )}
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {w.message}
                </p>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-zinc-500">NOTES</p>
            <p className="whitespace-pre-wrap text-sm text-zinc-600">{order.notes || 'No notes on this order.'}</p>
          </div>
        </div>
      )}
    </Drawer>
  )
}
