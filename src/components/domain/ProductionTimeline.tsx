import { Check, Circle } from 'lucide-react'
import type { Order } from '@/types'
import { clsx } from 'clsx'

interface Step {
  label: string
  done: boolean
}

function buildSteps(order: Order): Step[] {
  const productionStarted = !['New', 'Ready', 'Queued'].includes(order.productionStatus)

  return [
    { label: 'Order Created', done: true },
    { label: 'Artwork Uploaded', done: order.artwork.length > 0 },
    { label: 'Artwork Approved', done: ['Approved', 'Completed'].includes(order.artworkStatus) },
    {
      label: 'Garments Received',
      done: order.garmentStatus === 'Not Required' || ['Received', 'Supplied', 'Completed'].includes(order.garmentStatus),
    },
    { label: 'Production Started', done: productionStarted },
    { label: 'Completed', done: order.productionStatus === 'Completed' },
  ]
}

export function ProductionTimeline({ order }: { order: Order }) {
  const steps = buildSteps(order)

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <li key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={clsx(
                'flex h-6 w-6 items-center justify-center rounded-full border-2',
                step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-200 bg-white text-zinc-300',
              )}
            >
              {step.done ? <Check size={13} /> : <Circle size={8} fill="currentColor" />}
            </span>
            {i < steps.length - 1 && (
              <span className={clsx('w-0.5 flex-1', step.done ? 'bg-emerald-500' : 'bg-zinc-200')} style={{ minHeight: 20 }} />
            )}
          </div>
          <p className={clsx('pb-5 text-sm', step.done ? 'font-medium text-zinc-800' : 'text-zinc-400')}>{step.label}</p>
        </li>
      ))}
    </ol>
  )
}
