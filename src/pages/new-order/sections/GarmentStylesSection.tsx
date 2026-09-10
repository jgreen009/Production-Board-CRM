import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { GarmentsSection } from '@/pages/new-order/sections/GarmentsSection'
import { PrintDetailsSection } from '@/pages/new-order/sections/PrintDetailsSection'
import { ArtworkSection } from '@/pages/new-order/sections/ArtworkSection'

interface GarmentStylesSectionProps {
  orderId: string | null
  ensureOrderId: () => Promise<string>
}

export function GarmentStylesSection({ orderId, ensureOrderId }: GarmentStylesSectionProps) {
  return (
    <OrderFormSection
      step={5}
      title="Garment & Styles"
      description="Garments, print positions and sizes, the mockup preview, and artwork — all in one place."
    >
      <GarmentsSection />
      <hr className="border-zinc-100" />
      <ArtworkSection orderId={orderId} ensureOrderId={ensureOrderId} />
      <hr className="border-zinc-100" />
      <PrintDetailsSection />
    </OrderFormSection>
  )
}
