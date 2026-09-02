import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { ArtworkUploader } from '@/components/domain/ArtworkUploader'
import { ArtworkFileCard } from '@/components/domain/ArtworkFileCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Image } from 'lucide-react'

export function ArtworkSection() {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const files = watch('artworkFiles')

  return (
    <OrderFormSection step={6} title="Artwork & Files" description="Upload the customer's artwork or design files for this job.">
      <ArtworkUploader onFilesAdded={(added) => setValue('artworkFiles', [...files, ...added])} />

      {files.length === 0 ? (
        <EmptyState icon={Image} title="No artwork uploaded yet" description="Files added here become selectable in the mockup workspace below." />
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <ArtworkFileCard
              key={file.id}
              file={file}
              onRemove={() => setValue('artworkFiles', files.filter((f) => f.id !== file.id))}
              onReplace={() => setValue('artworkFiles', files.filter((f) => f.id !== file.id))}
            />
          ))}
        </div>
      )}
    </OrderFormSection>
  )
}
