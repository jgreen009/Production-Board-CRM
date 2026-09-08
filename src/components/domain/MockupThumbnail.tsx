import { Shirt, ImageOff } from 'lucide-react'
import type { PrintSpec } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'

interface MockupThumbnailProps {
  mockups: PrintSpec[]
  size?: number
}

export function MockupThumbnail({ mockups, size = 32 }: MockupThumbnailProps) {
  const spec = mockups[0]

  if (!spec) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 text-zinc-300"
      >
        <ImageOff size={14} />
      </div>
    )
  }

  const label = `${spec.garmentColour ?? ''} ${spec.garmentType ?? ''} — ${spec.position}`.trim()

  return (
    <Tooltip content={label}>
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-500"
      >
        <Shirt size={16} />
      </div>
    </Tooltip>
  )
}
