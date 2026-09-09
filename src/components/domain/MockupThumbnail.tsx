import { ImageOff, Shirt } from 'lucide-react'
import type { PrintSpec } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'
import { useMockupPreviewUrl } from '@/hooks/useMockupPreviews'
import { selectPrimaryPrintSpec } from '@/api/mappers/printSpec'

interface MockupThumbnailProps {
  mockups: PrintSpec[]
  size?: number
}

// Batch B: replaces the generic Shirt-icon placeholder with the actual
// saved mockup preview PNG, where one exists. Deliberately a plain <img>
// via a signed-URL hook — Production Board must never load Fabric just to
// show a thumbnail.
export function MockupThumbnail({ mockups, size = 32 }: MockupThumbnailProps) {
  const primary = selectPrimaryPrintSpec(mockups)
  const { data: previewUrl } = useMockupPreviewUrl(primary?.previewStoragePath)

  const boxClass = 'flex items-center justify-center overflow-hidden rounded-md border'

  if (!primary) {
    return (
      <Tooltip content="Awaiting artwork">
        <div style={{ width: size, height: size }} className={`${boxClass} border-dashed border-zinc-200 bg-zinc-50 text-zinc-300`}>
          <ImageOff size={14} />
        </div>
      </Tooltip>
    )
  }

  const label = `${primary.garmentColour ?? ''} ${primary.garmentType ?? ''} — ${primary.position}`.trim()

  if (previewUrl) {
    return (
      <Tooltip content={label}>
        <img
          src={previewUrl}
          alt={label}
          style={{ width: size, height: size }}
          className={`${boxClass} border-zinc-200 object-cover`}
        />
      </Tooltip>
    )
  }

  return (
    <Tooltip content={primary.previewStoragePath ? label : `${label} — no preview yet`}>
      <div style={{ width: size, height: size }} className={`${boxClass} border-zinc-200 bg-zinc-100 text-zinc-400`}>
        <Shirt size={16} />
      </div>
    </Tooltip>
  )
}
