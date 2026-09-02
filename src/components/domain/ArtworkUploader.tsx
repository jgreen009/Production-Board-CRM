import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { clsx } from 'clsx'
import type { ArtworkFileFormValues } from '@/schemas/orderFormSchema'
import type { ArtworkFileType } from '@/types'
import { generateId } from '@/utils/id'

const EXTENSION_MAP: Record<string, ArtworkFileType> = {
  png: 'PNG',
  jpg: 'JPG',
  jpeg: 'JPG',
  webp: 'WEBP',
  svg: 'SVG',
  pdf: 'PDF',
  ai: 'AI',
}

const PREVIEWABLE: ArtworkFileType[] = ['PNG', 'JPG', 'WEBP', 'SVG']

interface ArtworkUploaderProps {
  onFilesAdded: (files: ArtworkFileFormValues[]) => void
}

export function ArtworkUploader({ onFilesAdded }: ArtworkUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const parsed: ArtworkFileFormValues[] = Array.from(fileList).map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const fileType = EXTENSION_MAP[ext] ?? 'PDF'
      const previewUrl = PREVIEWABLE.includes(fileType) ? URL.createObjectURL(file) : undefined

      return {
        id: generateId('artwork'),
        fileName: file.name,
        fileType,
        sizeKb: Math.round(file.size / 1024),
        previewUrl,
      }
    })

    onFilesAdded(parsed)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
        dragOver ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50',
      )}
    >
      <UploadCloud size={24} className="text-zinc-300" />
      <p className="text-sm font-medium text-zinc-700">Drag and drop artwork here, or click to browse</p>
      <p className="text-xs text-zinc-400">PNG, JPG, WEBP, SVG, PDF, AI</p>
      <input
        ref={inputRef}
        type="file"
        multiple
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
