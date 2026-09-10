interface SizeQuantityGridProps {
  sizes: readonly string[]
  values: Record<string, number>
  onChange: (size: string, quantity: number) => void
  idPrefix: string
}

// Was a single horizontally-scrolling row of fixed-width inputs — on a
// 390px screen with 8 adult sizes that meant scrolling inside the card to
// reach the later sizes, and each input was only ~32px tall (under the
// ~44px mobile touch-target guideline). Wrapping into a 4-column grid on
// mobile (2 rows for 8 sizes, no scroll) and widening to one row from
// `sm` up, with taller inputs, fixes both without changing the data shape
// or onChange contract.
export function SizeQuantityGrid({ sizes, values, onChange, idPrefix }: SizeQuantityGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
      {sizes.map((size) => (
        <div key={size} className="flex flex-col items-center gap-1 sm:w-14 sm:shrink-0">
          <label htmlFor={`${idPrefix}-${size}`} className="text-xs font-medium text-zinc-500">
            {size}
          </label>
          <input
            id={`${idPrefix}-${size}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={values[size] ?? 0}
            onChange={(e) => onChange(size, Math.max(0, Number(e.target.value) || 0))}
            className="h-11 w-full rounded-md border border-zinc-300 px-1.5 text-center text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 sm:h-10"
          />
        </div>
      ))}
    </div>
  )
}
