import { clsx } from 'clsx'
import type { PrintPosition } from '@/types'

interface PrintPositionButtonsProps {
  /** The garment's own supported positions (getSupportedPrintPositions(garmentType)) — every button rendered here is valid for the current garment, so there is no "unsupported but visible" state any more. */
  positions: { position: PrintPosition; label: string }[]
  value: PrintPosition
  onChange: (position: PrintPosition) => void
}

// Extracted from MockupStudio.tsx (staff) so the public order form can
// reuse the exact same position-picker UI/interaction pattern — same
// markup, same selected-state styling — without duplicating it. Purely
// presentational: takes the current value and a change handler, has no
// opinion about which form library (react-hook-form for staff, plain
// state for the public form) is behind it.
//
// Renders ONLY the positions the caller passes in (Mockup System V2's
// non-upper-body extension — Beanie/Hats/Shorts/Pants each have their own
// small, anatomically-valid position set instead of the old "show all 9
// upper-body positions, dim the invalid ones" pattern). The caller is
// responsible for computing that list via
// config/garmentGeometry.ts's getSupportedPrintPositions(garmentType).
export function PrintPositionButtons({ positions, value, onChange }: PrintPositionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {positions.map((p) => (
        <button
          key={p.position}
          type="button"
          onClick={() => onChange(p.position)}
          className={clsx(
            'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === p.position
              ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
