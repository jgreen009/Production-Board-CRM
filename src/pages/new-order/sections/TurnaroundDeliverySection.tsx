import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Turnaround, DeliveryMethod, Priority } from '@/types'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { Toggle } from '@/components/ui/Field'
import { TURNAROUNDS, TURNAROUND_DESCRIPTIONS, PRIORITIES } from '@/data/mockStatuses'
import { clsx } from 'clsx'

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; hint?: string }[] = [
  { value: 'Pick Up', label: 'Pick Up' },
  { value: 'Delivery', label: 'Delivery', hint: 'Additional cost applies' },
]

export function TurnaroundDeliverySection() {
  const { watch, setValue } = useFormContext<OrderFormValues>()

  const rushFee = watch('rushFee')
  const turnaround = watch('turnaround')
  const deliveryMethod = watch('deliveryMethod')
  const priority = watch('priority')

  const handleRushFeeChange = (checked: boolean) => {
    setValue('rushFee', checked)
    if (checked) {
      setValue('turnaround', 'Rush')
      setValue('priority', 'High')
    } else if (turnaround === 'Rush') {
      setValue('turnaround', 'Standard')
    }
  }

  const handleTurnaroundChange = (value: Turnaround) => {
    setValue('turnaround', value)
    setValue('rushFee', value === 'Rush')
    if (value === 'Same Day') setValue('priority', 'Urgent')
  }

  return (
    <OrderFormSection step={3} title="Turnaround & Delivery">
      <Toggle
        label="Rush Fee"
        description="I need my order faster than standard turnaround time"
        checked={rushFee}
        onChange={handleRushFeeChange}
      />

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Turnaround</p>
        <p className="mb-2 text-xs text-zinc-400">Internal staff field — not shown on the paper form.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TURNAROUNDS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTurnaroundChange(t.value)}
              className={clsx(
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                turnaround === t.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
              )}
            >
              <p className="font-medium">{t.label}</p>
              <p className={clsx('mt-0.5 text-xs', turnaround === t.value ? 'text-zinc-300' : 'text-zinc-400')}>
                {TURNAROUND_DESCRIPTIONS[t.value]}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Pick Up / Delivery</p>
        <div className="flex gap-2">
          {DELIVERY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('deliveryMethod', opt.value)}
              className={clsx(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                deliveryMethod === opt.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
              )}
            >
              {opt.label}
              {opt.hint && (
                <span className={clsx('block text-xs font-normal', deliveryMethod === opt.value ? 'text-zinc-300' : 'text-zinc-400')}>
                  {opt.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Priority</p>
        <p className="mb-2 text-xs text-zinc-400">
          Internal-only — not on the paper form. Same Day sets this to Urgent automatically; Rush Fee suggests High. Staff can override.
        </p>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setValue('priority', p.value as Priority)}
              className={clsx(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                priority === p.value ? p.className : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </OrderFormSection>
  )
}
