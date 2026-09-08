import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { clsx } from 'clsx'

interface ArtworkUploaderProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  disabledHint?: string
}

// Presentational dropzone only — validation, uploading, and turning a File
// into form state all live in ArtworkSection, which is the one that knows
// about orderId and the real upload API.
export function ArtworkUploader({ onFilesSelected, disabled, disabledHint }: ArtworkUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return
    onFilesSelected(Array.from(fileList))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={clsx(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-zinc-100 bg-zinc-50/50'
          : 'cursor-pointer border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50',
        dragOver && !disabled && 'border-zinc-400 bg-zinc-50',
      )}
    >
      <UploadCloud size={24} className="text-zinc-300" />
      <p className="text-sm font-medium text-zinc-700">
        {disabled ? (disabledHint ?? 'Not available yet') : 'Drag and drop artwork here, or click to browse'}
      </p>
      {!disabled && <p className="text-xs text-zinc-400">PNG, JPG, WEBP, SVG, PDF, AI</p>}
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.ai"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
