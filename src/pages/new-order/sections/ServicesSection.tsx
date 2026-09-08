import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { Checkbox, Toggle } from '@/components/ui/Field'
import { SERVICE_CATALOG } from '@/data/mockServices'

export function ServicesSection() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormValues>()

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
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">What services do you require?</p>
        {errors.services?.message && (
          <p className="mb-2 text-xs text-red-600">{errors.services.message}</p>
        )}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {SERVICE_CATALOG.map((service) => (
            <Checkbox
              key={service.name}
              id={`service-${service.name}`}
              label={service.name}
              description={service.description}
              checked={services.includes(service.name)}
              onChange={(e) => toggleService(service.name, e.target.checked)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
