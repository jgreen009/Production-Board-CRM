import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Turnaround, DeliveryMethod, Priority } from '@/types'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { TURNAROUNDS, TURNAROUND_DESCRIPTIONS, PRIORITIES } from '@/data/mockStatuses'
import { useBusinessSettings } from '@/hooks/useSettings'
import { clsx } from 'clsx'

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string; hint?: string }[] = [
  { value: 'Pick Up', label: 'Pick Up' },
  { value: 'Delivery', label: 'Delivery', hint: 'Additional cost applies' },
]

// Only these three are offered on the order form; "Custom" stays a valid
// Turnaround value for badges elsewhere but isn't a pickable option here.
const FORM_TURNAROUND_ORDER: Turnaround[] = ['Same Day', 'Rush', 'Standard']
const FORM_TURNAROUNDS = FORM_TURNAROUND_ORDER.map(
  (value) => TURNAROUNDS.find((t) => t.value === value)!,
)

export function TurnaroundDeliverySection() {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const { data: businessSettings } = useBusinessSettings()

  const turnaround = watch('turnaround')
  const deliveryMethod = watch('deliveryMethod')
  const priority = watch('priority')

  // Falls back to the static copy (which already says "7–10 business
  // days", matching business_settings' own seeded defaults) until the
  // real row loads — never shows a stale hardcoded value once it has.
  const turnaroundDescriptions = businessSettings
    ? {
        ...TURNAROUND_DESCRIPTIONS,
        Standard: `Standard turnaround — ${businessSettings.standardTurnaroundMinDays}–${businessSettings.standardTurnaroundMaxDays} business days.`,
      }
    : TURNAROUND_DESCRIPTIONS

  const handleTurnaroundChange = (value: Turnaround) => {
    setValue('turnaround', value)
    setValue('rushFee', value === 'Rush')
    if (value === 'Same Day') setValue('priority', 'Urgent')
  }

  return (
    <OrderFormSection step={3} title="Turnaround & Delivery">
      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Turnaround</p>
        <p className="mb-2 text-xs text-zinc-400">Internal staff field — not shown on the paper form.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FORM_TURNAROUNDS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTurnaroundChange(t.value)}
              className={clsx(
                'min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                turnaround === t.value
                  ? 'border-brand-accent bg-brand-accent-soft text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
              )}
            >
              <p className="font-medium">{t.label}</p>
              <p className={clsx('mt-0.5 text-xs', turnaround === t.value ? 'text-zinc-600' : 'text-zinc-400')}>
                {turnaroundDescriptions[t.value]}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-700">Pick Up / Delivery</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DELIVERY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('deliveryMethod', opt.value)}
              className={clsx(
                'min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                deliveryMethod === opt.value
                  ? 'border-brand-accent bg-brand-accent-soft text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
              )}
            >
              {opt.label}
              {opt.hint && (
                <span className={clsx('block text-xs font-normal', deliveryMethod === opt.value ? 'text-zinc-600' : 'text-zinc-400')}>
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
          Internal-only — not on the paper form. Same Day sets this to Urgent automatically. Staff can override.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setValue('priority', p.value as Priority)}
              className={clsx(
                'min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
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
