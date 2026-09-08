import type { Order, ProductionStatus } from '@/types'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { StatusSelect } from '@/components/domain/StatusSelect'
import { MockupThumbnail } from '@/components/domain/MockupThumbnail'
import { PRODUCTION_STATUSES } from '@/data/mockStatuses'
import { dueDateLabel, isDueToday, isDueSoon, isOverdue } from '@/utils/date'
import { clsx } from 'clsx'

interface ProductionTableProps {
  orders: Order[]
  showDelivery: boolean
  onRowClick: (order: Order) => void
  onProductionStatusChange: (orderId: string, status: ProductionStatus) => void
}

export function ProductionTable({
  orders,
  showDelivery,
  onRowClick,
  onProductionStatusChange,
}: ProductionTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs text-zinc-500">
            <th className="px-3 py-2.5 font-medium">Order</th>
            <th className="px-3 py-2.5 font-medium">Customer</th>
            <th className="px-3 py-2.5 font-medium">Qty</th>
            <th className="px-3 py-2.5 font-medium">Due</th>
            <th className="px-3 py-2.5 font-medium">Payment</th>
            <th className="px-3 py-2.5 font-medium">Artwork</th>
            <th className="px-3 py-2.5 font-medium">Garments</th>
            <th className="px-3 py-2.5 font-medium">Production</th>
            <th className="px-3 py-2.5 font-medium">Priority</th>
            {showDelivery && <th className="px-3 py-2.5 font-medium">Delivery</th>}
            <th className="px-3 py-2.5 font-medium">Mockup</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => onRowClick(order)}
              className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-zinc-800">{order.orderNumber}</p>
                <p className="text-xs text-zinc-400">{order.jobName}</p>
              </td>
              <td className="px-3 py-2.5 text-zinc-600">{order.customer}</td>
              <td className="px-3 py-2.5 text-zinc-600">{order.quantity}</td>
              <td
                className={clsx(
                  'px-3 py-2.5 font-medium',
                  isOverdue(order.dueDate)
                    ? 'text-red-600'
                    : isDueToday(order.dueDate)
                      ? 'text-amber-600'
                      : isDueSoon(order.dueDate)
                        ? 'text-zinc-700'
                        : 'text-zinc-500',
                )}
              >
                {dueDateLabel(order.dueDate)}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge kind="payment" value={order.paymentStatus} />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge kind="artwork" value={order.artworkStatus} />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge kind="garment" value={order.garmentStatus} />
              </td>
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <StatusSelect
                  value={order.productionStatus}
                  options={PRODUCTION_STATUSES}
                  onChange={(v) => onProductionStatusChange(order.id, v)}
                />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge kind="priority" value={order.priority} />
              </td>
              {showDelivery && (
                <td className="px-3 py-2.5 text-zinc-600">{order.deliveryMethod}</td>
              )}
              <td className="px-3 py-2.5">
                <MockupThumbnail mockups={order.printSpecs} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
