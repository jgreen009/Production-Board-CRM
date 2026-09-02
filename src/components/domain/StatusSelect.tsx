import type { StatusConfig } from '@/data/mockStatuses'
import { clsx } from 'clsx'

interface StatusSelectProps<T extends string> {
  value: T
  options: StatusConfig<T>[]
  onChange: (value: T) => void
  className?: string
}

export function StatusSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: StatusSelectProps<T>) {
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={clsx(
        'appearance-none rounded-full border px-2.5 py-1 text-xs font-medium cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-zinc-900/10',
        current.className,
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-white text-zinc-800">
          {opt.label}
        </option>
      ))}
    </select>
  )
}
