import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-12 text-center">
      {Icon && <Icon size={28} className="text-zinc-300" strokeWidth={1.5} />}
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
