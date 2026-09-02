import {
  PlusCircle,
  Image,
  Shirt,
  Factory,
  Layers,
  DollarSign,
  Flag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrderActivityEntry } from '@/types'
import { formatDateTime } from '@/utils/date'
import { clsx } from 'clsx'

const TYPE_ICON: Record<OrderActivityEntry['type'], LucideIcon> = {
  created: PlusCircle,
  priority: Flag,
  artwork: Image,
  garments: Shirt,
  production: Factory,
  mockup: Layers,
  payment: DollarSign,
}

const TYPE_COLOR: Record<OrderActivityEntry['type'], string> = {
  created: 'bg-zinc-100 text-zinc-500',
  priority: 'bg-red-50 text-red-600',
  artwork: 'bg-purple-50 text-purple-600',
  garments: 'bg-amber-50 text-amber-600',
  production: 'bg-blue-50 text-blue-600',
  mockup: 'bg-indigo-50 text-indigo-600',
  payment: 'bg-emerald-50 text-emerald-600',
}

interface ActivityTimelineProps {
  entries: OrderActivityEntry[]
  showOrderNumber?: Record<string, string>
  className?: string
}

export function ActivityTimeline({ entries, showOrderNumber, className }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">No activity yet.</p>
  }

  return (
    <ol className={clsx('flex flex-col gap-4', className)}>
      {entries.map((entry) => {
        const Icon = TYPE_ICON[entry.type]
        return (
          <li key={entry.id} className="flex gap-3">
            <span
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                TYPE_COLOR[entry.type],
              )}
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm text-zinc-800">
                {entry.message}
                {showOrderNumber?.[entry.orderId] && (
                  <span className="ml-1.5 text-xs font-medium text-zinc-400">
                    {showOrderNumber[entry.orderId]}
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-400">{formatDateTime(entry.timestamp)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
