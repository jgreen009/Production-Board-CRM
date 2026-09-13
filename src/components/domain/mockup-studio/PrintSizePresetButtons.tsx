import { clsx } from 'clsx'
import { PRINT_SIZE_PRESETS } from '@/config/printSizePresets'

interface PrintSizePresetButtonsProps {
  activeKey: string | null
  onSelect: (widthMm: number) => void
}

// Extracted from MockupStudio.tsx (staff) — same reasoning as
// PrintPositionButtons: one shared presentational component instead of a
// second copy for the public order form.
export function PrintSizePresetButtons({ activeKey, onSelect }: PrintSizePresetButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRINT_SIZE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onSelect(preset.widthMm)}
          className={clsx(
            'min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
            activeKey === preset.key
              ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
