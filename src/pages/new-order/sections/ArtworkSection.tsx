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
import { staffErrorMessage } from '@/utils/errorMessage'

const PREVIEWABLE_TYPES = ['PNG', 'JPG', 'WEBP', 'SVG']

interface ArtworkSectionProps {
  // Real, already-persisted order id — present for Edit Order (the order
  // already exists) and, on the Create path, only after Create Order has
  // actually been clicked. Never created early just because a file was
  // selected — see NewOrderForm.tsx: nothing is written to the database
  // until the Create Order button itself runs.
  orderId: string | null
}

export function ArtworkSection({ orderId }: ArtworkSectionProps) {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const { showToast } = useToast()
  const files = watch('artworkFiles')
  const [uploadingNames, setUploadingNames] = useState<string[]>([])

  const handleFilesSelected = async (selected: File[]) => {
    for (const file of selected) {
      const validation = validateArtworkFile(file)
      if (!validation.valid || !validation.fileType) {
        showToast(`${file.name}: ${validation.reason}`, 'info')
        continue
      }
      const fileType = validation.fileType

      // No real order to attach this to yet (still filling in the Create
      // Order form) — hold it locally. NewOrderForm's Create Order submit
      // uploads every pendingFile for real once the order itself exists,
      // never before.
      if (!orderId) {
        const previewUrl = PREVIEWABLE_TYPES.includes(fileType) ? URL.createObjectURL(file) : undefined
        setValue('artworkFiles', [
          ...watch('artworkFiles'),
          {
            id: crypto.randomUUID(),
            fileName: file.name,
            fileType,
            sizeKb: Math.round(file.size / 1024),
            previewUrl,
            pendingFile: file,
          },
        ])
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
        showToast(staffErrorMessage(err, `${file.name}: Upload failed — try again`), 'info')
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
        showToast(staffErrorMessage(err, 'Failed to delete file from storage'), 'info')
      }
    }
    // A pendingFile was never uploaded anywhere — removing it from form
    // state above is the entire cleanup, nothing server-side to undo.
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">Artwork & Files</p>
      <p className="mb-3 text-xs text-zinc-400">Upload the customer's artwork or design files for this job.</p>
      <ArtworkUploader onFilesSelected={handleFilesSelected} />

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
        <div className="mt-2">
          <EmptyState icon={Image} title="No artwork uploaded yet" description="Files added here become selectable in the print specs above." />
        </div>
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
