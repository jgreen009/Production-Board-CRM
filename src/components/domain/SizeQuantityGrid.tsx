interface SizeQuantityGridProps {
  sizes: readonly string[]
  values: Record<string, number>
  onChange: (size: string, quantity: number) => void
  idPrefix: string
}

export function SizeQuantityGrid({ sizes, values, onChange, idPrefix }: SizeQuantityGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-1.5">
        {sizes.map((size) => (
          <div key={size} className="flex w-14 shrink-0 flex-col items-center gap-1">
            <label htmlFor={`${idPrefix}-${size}`} className="text-xs font-medium text-zinc-500">
              {size}
            </label>
            <input
              id={`${idPrefix}-${size}`}
              type="number"
              min={0}
              value={values[size] ?? 0}
              onChange={(e) => onChange(size, Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-md border border-zinc-300 px-1.5 py-1.5 text-center text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
