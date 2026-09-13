import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { ServiceCheckboxGrid } from '@/components/domain/ServiceCheckboxGrid'
import { Toggle } from '@/components/ui/Field'
import { useServicesSettings } from '@/hooks/useSettings'

export function ServicesSection() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()
  const { data: catalog = [] } = useServicesSettings()

  const services = watch('services')
  const suppliesGarments = watch('suppliesGarments')
  const graphicDesignServices = watch('graphicDesignServices')

  const toggleService = (name: string, checked: boolean) => {
    if (checked) setValue('services', [...services, name])
    else setValue('services', services.filter((s) => s !== name))
  }

  return (
    <OrderFormSection
      step={4}
      title="Services Required"
      description="Matches the paper form's checkbox list, in the same order."
    >
      <ServiceCheckboxGrid services={catalog} selected={services} onToggle={toggleService} error={errors.services?.message} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Toggle
          label="Do you require us to supply Garments"
          checked={suppliesGarments}
          onChange={(v) => setValue('suppliesGarments', v)}
        />
        <Toggle
          label="Graphic Design Services"
          checked={graphicDesignServices}
          onChange={(v) => setValue('graphicDesignServices', v)}
        />
      </div>
    </OrderFormSection>
  )
}
