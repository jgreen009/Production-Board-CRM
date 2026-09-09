import { FileIcon } from 'lucide-react'
import { clsx } from 'clsx'
import type { ArtworkFileFormValues } from '@/schemas/orderFormSchema'

const PREVIEWABLE_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

interface ArtworkSelectorProps {
  files: ArtworkFileFormValues[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
}

// Batch A: shows a thumbnail where previewable, and clearly marks
// non-previewable files (PDF/AI) rather than hiding them — staff still
// need to associate a PrintSpec with the original file even though the
// canvas can't render it (see MockupStudio's "Preview unavailable" state).
export function ArtworkSelector({ files, selectedId, onSelect }: ArtworkSelectorProps) {
  if (files.length === 0) {
    return <p className="text-xs text-zinc-400">Upload artwork above to select it here.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={clsx(
          'rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
          !selectedId ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300',
        )}
      >
        No artwork selected
      </button>
      {files.map((file) => {
        const previewable = PREVIEWABLE_TYPES.includes(file.fileType)
        const active = selectedId === file.id
        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onSelect(file.id)}
            className={clsx(
              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
              active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300',
            )}
          >
            <div
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border',
                active ? 'border-white/30 bg-white/10' : 'border-zinc-100 bg-zinc-50',
              )}
            >
              {previewable && file.previewUrl ? (
                <img src={file.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileIcon size={14} className={active ? 'text-white/70' : 'text-zinc-300'} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{file.fileName}</p>
              <p className={clsx('text-[11px]', active ? 'text-white/70' : 'text-zinc-400')}>
                {file.fileType} {!previewable && '• Preview unavailable'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
