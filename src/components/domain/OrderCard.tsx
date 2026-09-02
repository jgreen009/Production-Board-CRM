import type { ReactNode } from 'react'
import type { Order } from '@/types'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { dueDateLabel, isDueToday, isOverdue } from '@/utils/date'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface OrderCardProps {
  order: Order
  onClick?: (order: Order) => void
  extra?: ReactNode
}

export function OrderCard({ order, onClick, extra }: OrderCardProps) {
  return (
    <Card
      className={clsx('p-3', onClick && 'cursor-pointer hover:border-zinc-300')}
      onClick={() => onClick?.(order)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-800">{order.jobName}</p>
          <p className="text-xs text-zinc-400">{order.orderNumber} — {order.customer}</p>
        </div>
        <span
          className={clsx(
            'shrink-0 text-xs font-semibold',
            isOverdue(order.dueDate)
              ? 'text-red-600'
              : isDueToday(order.dueDate)
                ? 'text-amber-600'
                : 'text-zinc-500',
          )}
        >
          {dueDateLabel(order.dueDate)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge kind="production" value={order.productionStatus} />
        <StatusBadge kind="priority" value={order.priority} />
        <span className="text-xs text-zinc-400">Qty {order.quantity}</span>
      </div>

      {extra && <div className="mt-2 flex flex-wrap items-center gap-1.5">{extra}</div>}
    </Card>
  )
}
