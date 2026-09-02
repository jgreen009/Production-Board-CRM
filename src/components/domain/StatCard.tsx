import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: { direction: 'up' | 'down'; label: string; positive?: boolean }
  accent?: 'default' | 'warning' | 'danger'
}

const accentClasses: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'text-zinc-900',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  accent = 'default',
}: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-zinc-500">{label}</span>
        {Icon && <Icon size={16} className="text-zinc-300" />}
      </div>
      <div className={clsx('mt-2 text-2xl font-semibold', accentClasses[accent])}>{value}</div>
      {description && <p className="mt-1 text-xs text-zinc-400">{description}</p>}
      {trend && (
        <div
          className={clsx(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium',
            trend.positive === false ? 'text-red-600' : 'text-emerald-600',
          )}
        >
          {trend.direction === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {trend.label}
        </div>
      )}
    </Card>
  )
}
