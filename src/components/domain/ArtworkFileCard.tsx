import { FileIcon, X } from 'lucide-react'
import type { ArtworkFileFormValues } from '@/schemas/orderFormSchema'

const TYPE_LABELS: Record<string, string> = {
  AI: 'Adobe Illustrator Artwork',
  PDF: 'PDF Document',
  PNG: 'PNG Image',
  JPG: 'JPEG Image',
  WEBP: 'WEBP Image',
  SVG: 'SVG Vector',
}

interface ArtworkFileCardProps {
  file: ArtworkFileFormValues
  onRemove: () => void
}

export function ArtworkFileCard({ file, onRemove }: ArtworkFileCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-100 bg-zinc-50">
        {file.previewUrl ? (
          <img src={file.previewUrl} alt={file.fileName} className="h-full w-full object-cover" />
        ) : (
          <FileIcon size={18} className="text-zinc-300" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{file.fileName}</p>
        <p className="text-xs text-zinc-400">
          {TYPE_LABELS[file.fileType] ?? file.fileType} · {file.sizeKb} KB
        </p>
        {!file.previewUrl && <p className="text-xs text-zinc-400">Preview unavailable · Ready for upload</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remove file"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
