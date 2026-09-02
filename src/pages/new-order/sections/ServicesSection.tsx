import { useFormContext } from 'react-hook-form'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { Checkbox, Toggle, Textarea, FormField } from '@/components/ui/Field'
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
  const specialisedApplication = watch('specialisedApplication')
  const rushFee = watch('rushFee')

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
        {errors.services?.message && (
          <p className="mb-2 text-xs text-red-600">{errors.services.message}</p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

      <div className="flex flex-col gap-2">
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
        <Toggle
          label="Specialised Application (Puff, Metallic etc.)"
          checked={specialisedApplication}
          onChange={(v) => setValue('specialisedApplication', v)}
        />
        {specialisedApplication && (
          <FormField label="Application Details" htmlFor="specialisedApplicationDetails">
            <Textarea
              id="specialisedApplicationDetails"
              rows={2}
              placeholder="e.g. Puff print on front logo lettering"
              value={watch('specialisedApplicationDetails') ?? ''}
              onChange={(e) => setValue('specialisedApplicationDetails', e.target.value)}
            />
          </FormField>
        )}
        <Toggle
          label="Rush Fee"
          description="I need my order faster than standard turnaround time (mirrors the Turnaround & Delivery section above)"
          checked={rushFee}
          onChange={(v) => {
            setValue('rushFee', v)
            if (v) {
              setValue('turnaround', 'Rush')
              setValue('priority', 'High')
            } else if (watch('turnaround') === 'Rush') {
              setValue('turnaround', 'Standard')
            }
          }}
        />
      </div>
    </OrderFormSection>
  )
}
