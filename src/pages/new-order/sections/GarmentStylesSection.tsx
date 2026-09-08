import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { GarmentsSection } from '@/pages/new-order/sections/GarmentsSection'
import { PrintDetailsSection } from '@/pages/new-order/sections/PrintDetailsSection'
import { ArtworkSection } from '@/pages/new-order/sections/ArtworkSection'

interface GarmentStylesSectionProps {
  orderId: string | null
}

export function GarmentStylesSection({ orderId }: GarmentStylesSectionProps) {
  return (
    <OrderFormSection
      step={5}
      title="Garment & Styles"
      description="Garments, print positions and sizes, the mockup preview, and artwork — all in one place."
    >
      <GarmentsSection />
      <hr className="border-zinc-100" />
      <PrintDetailsSection />
      <hr className="border-zinc-100" />
      <ArtworkSection orderId={orderId} />
    </OrderFormSection>
  )
}
