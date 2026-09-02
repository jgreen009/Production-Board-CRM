import { useFormContext } from 'react-hook-form'
import type { OrderFormValues, MockupFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { MockupWorkspace } from '@/components/domain/MockupWorkspace'

export function MockupSection() {
  const { watch, setValue } = useFormContext<OrderFormValues>()

  const garments = watch('garments')
  const artworkFiles = watch('artworkFiles')
  const mockups = watch('mockups')

  const handleAddMockup = (mockup: MockupFormValues) => {
    setValue('mockups', [...mockups, mockup])
  }

  return (
    <OrderFormSection
      step={7}
      title="Mockup Workspace"
      description="Communicate exactly what will be printed — pick a garment, position, and artwork to preview it."
    >
      <MockupWorkspace
        garments={garments}
        artworkFiles={artworkFiles}
        mockups={mockups}
        onAddMockup={handleAddMockup}
      />
    </OrderFormSection>
  )
}
