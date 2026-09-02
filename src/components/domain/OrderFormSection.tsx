import type { ReactNode } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'

interface OrderFormSectionProps {
  title: string
  description?: string
  step?: number
  children: ReactNode
  actions?: ReactNode
}

export function OrderFormSection({ title, description, step, children, actions }: OrderFormSectionProps) {
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {step != null && (
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
              {step}
            </span>
          )}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
        </div>
        {actions}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">{children}</CardBody>
    </Card>
  )
}
