import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { Checkbox, Toggle } from '@/components/ui/Field'
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

  // Active services, plus any already-selected one that's since been
  // disabled — an existing order (or an in-progress draft) keeps showing
  // its selection rather than silently losing it from the list.
  const visibleServices = catalog.filter((s) => s.active || services.includes(s.name))

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
        <p className="mb-2 text-sm font-medium text-zinc-700">
          What services do you require? <span className="text-danger">*</span>
        </p>
        {errors.services?.message && (
          <p className="mb-2 text-xs font-medium text-danger">{errors.services.message}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {visibleServices.map((service) => (
            <Checkbox
              key={service.id}
              id={`service-${service.id}`}
              label={service.name}
              checked={services.includes(service.name)}
              onChange={(e) => toggleService(service.name, e.target.checked)}
            />
          ))}
        </div>
      </div>

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
