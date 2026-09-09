import { AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import type { Order } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'
import { getAttentionWarnings } from '@/utils/productionReadiness'

const SEVERITY_COLOUR = {
  critical: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-zinc-400',
} as const

// Batch C: a single compact icon per row (not five new warning columns) —
// hover reveals every current reason via the same getAttentionWarnings()
// logic the Dashboard uses, so the two surfaces never disagree.
export function AttentionBadge({ order }: { order: Order }) {
  const warnings = getAttentionWarnings(order)
  if (warnings.length === 0) return null

  const tooltip = warnings.map((w) => w.message).join('\n')

  return (
    <Tooltip content={tooltip}>
      <span className={clsx('inline-flex', SEVERITY_COLOUR[warnings[0].severity])}>
        <AlertTriangle size={14} />
      </span>
    </Tooltip>
  )
}
