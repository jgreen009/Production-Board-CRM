import { Shirt, ImageOff } from 'lucide-react'
import type { Mockup } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'

interface MockupThumbnailProps {
  mockups: Mockup[]
  size?: number
}

export function MockupThumbnail({ mockups, size = 32 }: MockupThumbnailProps) {
  const mockup = mockups[0]

  if (!mockup) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 text-zinc-300"
      >
        <ImageOff size={14} />
      </div>
    )
  }

  return (
    <Tooltip content={mockup.thumbnailLabel}>
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-500"
      >
        <Shirt size={16} />
      </div>
    </Tooltip>
  )
}
