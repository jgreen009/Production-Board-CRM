import { useNavigate } from 'react-router-dom'
import { Phone, Mail } from 'lucide-react'
import type { Order } from '@/types'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { MockupThumbnail } from '@/components/domain/MockupThumbnail'
import { useToast } from '@/components/ui/toast-context'
import { formatDate } from '@/utils/date'

interface OrderQuickViewProps {
  order: Order | null
  onClose: () => void
}

export function OrderQuickView({ order, onClose }: OrderQuickViewProps) {
  const navigate = useNavigate()
  const { showToast } = useToast()

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
            <Button
              variant="secondary"
              onClick={() => showToast('Full edit form arrives with backend integration.', 'info')}
            >
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
            <div>
              <p className="text-sm font-medium text-zinc-800">{order.customer}</p>
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
              <dd className="font-medium text-zinc-800">{formatDate(order.dueDate)}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-zinc-500">STATUS</p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge kind="payment" value={order.paymentStatus} />
              <StatusBadge kind="artwork" value={order.artworkStatus} />
              <StatusBadge kind="garment" value={order.garmentStatus} />
              <StatusBadge kind="production" value={order.productionStatus} />
              <StatusBadge kind="priority" value={order.priority} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-zinc-500">NOTES</p>
            <p className="text-sm text-zinc-600">{order.notes || 'No notes on this order.'}</p>
          </div>
        </div>
      )}
    </Drawer>
  )
}
