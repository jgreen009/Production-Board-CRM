import { MockupStudio } from '@/components/domain/mockup-studio/MockupStudio'

export function PrintDetailsSection() {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">Print Details &amp; Mockups</p>
      <p className="mb-3 text-xs text-zinc-400">
        One entry per print — position, garment, artwork, and size — with a live editable preview of where it lands.
      </p>
      <MockupStudio />
    </div>
  )
}
