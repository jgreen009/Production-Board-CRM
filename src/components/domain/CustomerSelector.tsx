import { useMemo, useRef, useState } from 'react'
import { Search, UserPlus, X, Check } from 'lucide-react'
import type { Customer } from '@/types'
import { mockCustomers } from '@/data/mockCustomers'
import { clsx } from 'clsx'

interface CustomerSelectorProps {
  customerId: string | null
  newCustomerName: string
  onSelectCustomer: (customer: Customer) => void
  onCreateNew: (name: string) => void
  onClear: () => void
}

export function CustomerSelector({
  customerId,
  newCustomerName,
  onSelectCustomer,
  onCreateNew,
  onClear,
}: CustomerSelectorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedCustomer = mockCustomers.find((c) => c.id === customerId) ?? null

  const results = useMemo(() => {
    if (!query.trim()) return mockCustomers.slice(0, 6)
    const q = query.trim().toLowerCase()
    return mockCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q),
    )
  }, [query])

  if (selectedCustomer || newCustomerName) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-800">
            {selectedCustomer ? selectedCustomer.name : newCustomerName}
            {!selectedCustomer && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                NEW
              </span>
            )}
          </p>
          {selectedCustomer?.company && (
            <p className="truncate text-xs text-zinc-400">{selectedCustomer.company}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
          aria-label="Change customer"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search customers by name or company..."
          className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {results.length > 0 ? (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelectCustomer(c)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span>
                  <span className="font-medium text-zinc-800">{c.name}</span>
                  {c.company && <span className="ml-1.5 text-xs text-zinc-400">{c.company}</span>}
                </span>
                {customerId === c.id && <Check size={14} className="text-zinc-500" />}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-zinc-400">No matching customers</p>
          )}

          {query.trim().length > 1 && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(query.trim())
                setOpen(false)
                setQuery('')
              }}
              className={clsx(
                'flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50',
              )}
            >
              <UserPlus size={14} />
              Create New Customer &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}
