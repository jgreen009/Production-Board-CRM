import { clsx } from 'clsx'
import type { PrintPosition } from '@/types'
import { ALL_PRINT_POSITIONS } from '@/config/garmentGeometry'

interface PrintPositionButtonsProps {
  value: PrintPosition
  onChange: (position: PrintPosition) => void
  isSupported: (position: PrintPosition) => boolean
  unsupportedTitle?: (position: PrintPosition) => string
}

// Extracted from MockupStudio.tsx (staff) so the public order form can
// reuse the exact same position-picker UI/interaction pattern — same
// markup, same visual states (selected / supported / unsupported-but-
// visible) — without duplicating it. Purely presentational: takes the
// current value and a change handler, has no opinion about which form
// library (react-hook-form for staff, plain state for the public form) is
// behind it.
export function PrintPositionButtons({ value, onChange, isSupported, unsupportedTitle }: PrintPositionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_PRINT_POSITIONS.map((p) => {
        const supported = isSupported(p.position)
        return (
          <button
            key={p.position}
            type="button"
            onClick={() => onChange(p.position)}
            title={supported ? undefined : unsupportedTitle?.(p.position)}
            className={clsx(
              'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === p.position
                ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
                : supported
                  ? 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  : 'border-zinc-100 bg-white text-zinc-300 hover:border-zinc-200',
            )}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
