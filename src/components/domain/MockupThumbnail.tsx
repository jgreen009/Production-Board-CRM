import { ImageOff } from 'lucide-react'
import type { GarmentItem, PrintSpec } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'
import { useMockupPreviewUrl } from '@/hooks/useMockupPreviews'
import { countAdditionalPrintSpecs, selectPrimaryPrintSpec } from '@/api/mappers/printSpec'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { getPositionView, isPrintPositionSupported } from '@/config/garmentGeometry'

interface MockupThumbnailProps {
  mockups: PrintSpec[]
  /** Order.garments — used only for the live V2 fallback's garmentType/colour when the primary spec doesn't carry its own (Batch B). */
  garments?: GarmentItem[]
  size?: number
  /** Shows a "+N" badge for additional PrintSpecs beyond the one shown — opt-in so Production Board's existing single-preview look is unaffected unless a caller asks for it (Batch B, Orders list). */
  showAdditionalCount?: boolean
}

// Batch B: replaces the generic Shirt-icon placeholder with a live,
// deterministic V2 mockup (GarmentMockup — no Fabric) when a saved preview
// PNG doesn't exist yet but there's enough data to render one accurately;
// falls back to the plain icon only when the garment/position combination
// isn't supported (Batch A's "unsupported" tier) or no garment data is
// available at all. Deliberately a plain <img>/lightweight renderer via a
// signed-URL hook for the saved-preview case — Production Board and Orders
// must never load Fabric just to show a thumbnail.
export function MockupThumbnail({ mockups, garments, size = 32, showAdditionalCount = false }: MockupThumbnailProps) {
  const primary = selectPrimaryPrintSpec(mockups)
  const { data: previewUrl } = useMockupPreviewUrl(primary?.previewStoragePath)
  const additionalCount = showAdditionalCount ? countAdditionalPrintSpecs(mockups) : 0

  const boxClass = 'relative flex items-center justify-center overflow-hidden rounded-md border'

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

  const countBadge = additionalCount > 0 && (
    <span
      className="absolute -bottom-1 -right-1 rounded-full border border-white bg-zinc-800 px-1 text-[9px] font-semibold leading-[14px] text-white"
      aria-hidden="true"
    >
      +{additionalCount}
    </span>
  )

  if (previewUrl) {
    return (
      <Tooltip content={label}>
        <div style={{ width: size, height: size }} className={`${boxClass} border-zinc-200`}>
          <img src={previewUrl} alt={label} loading="lazy" className="h-full w-full object-cover" />
          {countBadge}
        </div>
      </Tooltip>
    )
  }

  const garmentType = primary.garmentType ?? garments?.[0]?.type
  const garmentColour = primary.garmentColour ?? garments?.[0]?.colour ?? ''
  const canShowLiveFallback = !!garmentType && isPrintPositionSupported(garmentType, primary.position)

  if (canShowLiveFallback && garmentType) {
    return (
      <Tooltip content={`${label} — no saved preview yet`}>
        <div style={{ width: size, height: size }} className={`${boxClass} border-zinc-200 bg-white`}>
          <GarmentMockup
            garmentType={garmentType}
            colour={garmentColour}
            view={getPositionView(primary.position)}
            position={primary.position}
            widthMm={primary.widthMm}
            heightMm={primary.heightMm}
            size={size}
          />
          {countBadge}
        </div>
      </Tooltip>
    )
  }

  // Distinguishes "no preview generated yet" (a supported combination that
  // just hasn't been saved/generated) from "not configured for this
  // garment" (Batch A's unsupported tier — Shorts/Pants/Bennie/Hats, or
  // simply no garment data available at all) — Part 3's "do not conflate"
  // rule, applied to this last-resort icon state too.
  const noFallbackReason = garmentType ? 'Mockup placement not configured for this garment' : 'No preview yet'

  return (
    <Tooltip content={`${label} — ${noFallbackReason}`}>
      <div style={{ width: size, height: size }} className={`${boxClass} border-zinc-200 bg-zinc-100 text-zinc-400`}>
        <ImageOff size={16} />
        {countBadge}
      </div>
    </Tooltip>
  )
}
