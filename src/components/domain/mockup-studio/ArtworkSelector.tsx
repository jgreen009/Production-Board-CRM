import { FileIcon } from 'lucide-react'
import { Select } from '@/components/ui/Field'
import type { ArtworkFileFormValues } from '@/schemas/orderFormSchema'

const PREVIEWABLE_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

interface ArtworkSelectorProps {
  files: ArtworkFileFormValues[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
}

// A dropdown rather than a button list — one selection at a time, matching
// every other single-choice field in the Mockup Studio (Preview Garment,
// Print Position, etc.). Non-previewable files (PDF/AI) still show in the
// list rather than being hidden — staff still need to associate a
// PrintSpec with the original file even though the canvas can't render it.
export function ArtworkSelector({ files, selectedId, onSelect }: ArtworkSelectorProps) {
  if (files.length === 0) {
    return <p className="text-xs text-zinc-400">Upload artwork above to select it here.</p>
  }

  const selected = files.find((f) => f.id === selectedId)
  const selectedPreviewable = selected && PREVIEWABLE_TYPES.includes(selected.fileType)

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value || undefined)}>
        <option value="">No artwork selected</option>
        {files.map((file) => {
          const previewable = PREVIEWABLE_TYPES.includes(file.fileType)
          return (
            <option key={file.id} value={file.id}>
              {file.fileName} ({file.fileType}{previewable ? '' : ' — no preview'})
            </option>
          )
        })}
      </Select>

      {selected && (
        <div className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
            {selectedPreviewable && selected.previewUrl ? (
              <img src={selected.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <FileIcon size={14} className="text-zinc-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-700">{selected.fileName}</p>
            {!selectedPreviewable && <p className="text-[11px] text-zinc-400">Preview unavailable for this file type</p>}
          </div>
        </div>
      )}
    </div>
  )
}
