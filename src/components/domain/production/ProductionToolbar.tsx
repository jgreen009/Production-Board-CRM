import { Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { BOARD_VIEWS } from '@/hooks/useProductionBoard'
import type { BoardFilters, BoardView, SortKey } from '@/hooks/useProductionBoard'
import { PRODUCTION_STATUSES, ARTWORK_STATUSES, GARMENT_STATUSES, PRIORITIES } from '@/data/mockStatuses'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

interface ProductionToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  view: BoardView
  onViewChange: (v: BoardView) => void
  filters: BoardFilters
  onFilterChange: <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => void
  onResetFilters: () => void
  sortKey: SortKey
  onSortKeyChange: (k: SortKey) => void
  sortDir: 'asc' | 'desc'
  onSortDirChange: (d: 'asc' | 'desc') => void
  showDelivery: boolean
  onShowDeliveryChange: (v: boolean) => void
  resultCount: number
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'dueDate', label: 'Due Date' },
  { key: 'priority', label: 'Priority' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'createdAt', label: 'Created' },
]

export function ProductionToolbar(props: ProductionToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)

  const activeFilterCount = Object.values(props.filters).filter((v) => v !== 'All').length

  return (
    <div className="mb-3 flex flex-col gap-3">
      <Tabs
        tabs={BOARD_VIEWS.map((v) => ({ key: v.key, label: v.label }))}
        active={props.view}
        onChange={(k) => props.onViewChange(k as BoardView)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>

        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFiltersOpen((o) => !o)
              setColumnsOpen(false)
            }}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-zinc-900 px-1.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {filtersOpen && (
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500">FILTERS</span>
                <button
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700"
                  onClick={props.onResetFilters}
                >
                  <X size={12} /> Reset
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <FilterRow label="Production">
                  <Select
                    value={props.filters.production}
                    onChange={(e) => props.onFilterChange('production', e.target.value as never)}
                  >
                    <option value="All">All</option>
                    {PRODUCTION_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </FilterRow>
                <FilterRow label="Artwork">
                  <Select
                    value={props.filters.artwork}
                    onChange={(e) => props.onFilterChange('artwork', e.target.value as never)}
                  >
                    <option value="All">All</option>
                    {ARTWORK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </FilterRow>
                <FilterRow label="Garments">
                  <Select
                    value={props.filters.garment}
                    onChange={(e) => props.onFilterChange('garment', e.target.value as never)}
                  >
                    <option value="All">All</option>
                    {GARMENT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </FilterRow>
                <FilterRow label="Priority">
                  <Select
                    value={props.filters.priority}
                    onChange={(e) => props.onFilterChange('priority', e.target.value as never)}
                  >
                    <option value="All">All</option>
                    {PRIORITIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </Select>
                </FilterRow>
                <FilterRow label="Due Date">
                  <Select
                    value={props.filters.due}
                    onChange={(e) => props.onFilterChange('due', e.target.value as never)}
                  >
                    <option value="All">All</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Today">Today</option>
                    <option value="This Week">This Week</option>
                  </Select>
                </FilterRow>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setColumnsOpen((o) => !o)
              setFiltersOpen(false)
            }}
          >
            Columns
          </Button>
          {columnsOpen && (
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
              <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={props.showDelivery}
                  onChange={(e) => props.onShowDeliveryChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
                Delivery column
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Select
            value={props.sortKey}
            onChange={(e) => props.onSortKeyChange(e.target.value as SortKey)}
            className="w-auto"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>Sort: {s.label}</option>
            ))}
          </Select>
          <button
            className="rounded-md border border-zinc-300 p-2 text-zinc-500 hover:bg-zinc-50"
            onClick={() => props.onSortDirChange(props.sortDir === 'asc' ? 'desc' : 'asc')}
            aria-label="Toggle sort direction"
          >
            <ArrowUpDown size={14} className={clsx(props.sortDir === 'desc' && 'rotate-180')} />
          </button>
        </div>

        <span className="ml-auto hidden text-xs text-zinc-400 sm:inline">
          {props.resultCount} order{props.resultCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-zinc-600">{label}</span>
      <div className="w-36">{children}</div>
    </div>
  )
}
