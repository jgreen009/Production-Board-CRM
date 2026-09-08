import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { ArtworkUploader } from '@/components/domain/ArtworkUploader'
import { ArtworkFileCard } from '@/components/domain/ArtworkFileCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Image } from 'lucide-react'

export function ArtworkSection() {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const files = watch('artworkFiles')

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">Artwork & Files</p>
      <p className="mb-3 text-xs text-zinc-400">Upload the customer's artwork or design files for this job.</p>
      <ArtworkUploader onFilesAdded={(added) => setValue('artworkFiles', [...files, ...added])} />

      {files.length === 0 ? (
        <EmptyState icon={Image} title="No artwork uploaded yet" description="Files added here become selectable in the print specs above." />
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <ArtworkFileCard
              key={file.id}
              file={file}
              onRemove={() => setValue('artworkFiles', files.filter((f) => f.id !== file.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
