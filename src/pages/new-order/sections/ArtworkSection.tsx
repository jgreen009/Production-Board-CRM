import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { ArtworkUploader } from '@/components/domain/ArtworkUploader'
import { ArtworkFileCard } from '@/components/domain/ArtworkFileCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Image, Loader2 } from 'lucide-react'
import { uploadArtwork, removeArtwork } from '@/api/artwork'
import { validateArtworkFile } from '@/utils/artworkValidation'
import { useToast } from '@/components/ui/toast-context'

const PREVIEWABLE_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

interface ArtworkSectionProps {
  orderId: string | null
}

export function ArtworkSection({ orderId }: ArtworkSectionProps) {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const { showToast } = useToast()
  const files = watch('artworkFiles')
  const [uploadingNames, setUploadingNames] = useState<string[]>([])

  const handleFilesSelected = async (selected: File[]) => {
    if (!orderId) {
      showToast('Enter a name above first — artwork needs an order to attach to.', 'info')
      return
    }

    for (const file of selected) {
      const validation = validateArtworkFile(file)
      if (!validation.valid) {
        showToast(`${file.name}: ${validation.reason}`, 'info')
        continue
      }

      setUploadingNames((prev) => [...prev, file.name])
      try {
        const artwork = await uploadArtwork(orderId, file)
        const previewUrl = PREVIEWABLE_TYPES.includes(artwork.fileType) ? URL.createObjectURL(file) : undefined
        setValue('artworkFiles', [
          ...watch('artworkFiles'),
          {
            id: artwork.id,
            fileName: artwork.fileName,
            fileType: artwork.fileType,
            sizeKb: artwork.sizeKb,
            previewUrl,
            storagePath: artwork.storagePath,
          },
        ])
      } catch (err) {
        showToast(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`, 'info')
      } finally {
        setUploadingNames((prev) => prev.filter((name) => name !== file.name))
      }
    }
  }

  const handleRemove = async (file: OrderFormValues['artworkFiles'][number]) => {
    const remaining = watch('artworkFiles').filter((f) => f.id !== file.id)
    setValue('artworkFiles', remaining)
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)

    if (file.storagePath) {
      try {
        await removeArtwork(file.id, file.storagePath)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete file from storage', 'info')
      }
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">Artwork & Files</p>
      <p className="mb-3 text-xs text-zinc-400">Upload the customer's artwork or design files for this job.</p>
      <ArtworkUploader
        onFilesSelected={handleFilesSelected}
        disabled={!orderId}
        disabledHint="Enter a name above to start attaching artwork"
      />

      {uploadingNames.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {uploadingNames.map((name) => (
            <div key={name} className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 size={12} className="animate-spin" /> Uploading {name}...
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && uploadingNames.length === 0 ? (
        <EmptyState icon={Image} title="No artwork uploaded yet" description="Files added here become selectable in the print specs above." />
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {files.map((file) => (
            <ArtworkFileCard key={file.id} file={file} onRemove={() => handleRemove(file)} />
          ))}
        </div>
      )}
    </div>
  )
}
