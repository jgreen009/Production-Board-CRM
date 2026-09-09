import { Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'

export interface PrintSpecTabEntry {
  id: string
  label: string
}

interface PrintSpecTabsProps {
  view: 'Front' | 'Back'
  onViewChange: (view: 'Front' | 'Back') => void
  frontEntries: PrintSpecTabEntry[]
  backEntries: PrintSpecTabEntry[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  canRemove: boolean
}

// Front/Back is a pure navigation grouping over the existing printSpecs
// array (Phase 3 plan §9) — it never persists anything of its own. Which
// entries land in which tab is derived entirely from each PrintSpec's own
// position -> view mapping (src/config/printZones.ts), computed by the
// caller.
export function PrintSpecTabs({
  view,
  onViewChange,
  frontEntries,
  backEntries,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  canRemove,
}: PrintSpecTabsProps) {
  const entries = view === 'Front' ? frontEntries : backEntries

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1 rounded-md bg-zinc-100 p-1 text-sm font-medium" role="tablist" aria-label="Garment view">
        {(['Front', 'Back'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onViewChange(v)}
            className={clsx(
              'flex-1 rounded px-3 py-1.5 transition-colors',
              view === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
            )}
          >
            {v} {v === 'Front' ? `(${frontEntries.length})` : `(${backEntries.length})`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={clsx(
              'group flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              activeId === entry.id
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
            )}
          >
            <button type="button" onClick={() => onSelect(entry.id)} aria-current={activeId === entry.id}>
              {entry.label}
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                aria-label={`Remove ${entry.label}`}
                className={clsx(
                  'rounded p-0.5',
                  activeId === entry.id ? 'text-white/70 hover:text-white' : 'text-zinc-400 hover:text-red-600',
                )}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
        >
          <Plus size={12} /> Add Print
        </button>
      </div>
    </div>
  )
}
