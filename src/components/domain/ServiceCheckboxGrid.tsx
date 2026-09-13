import { Checkbox } from '@/components/ui/Field'

export interface ServiceCatalogEntry {
  id: string
  name: string
  active: boolean
}

interface ServiceCheckboxGridProps {
  services: ServiceCatalogEntry[]
  selected: string[]
  onToggle: (name: string, checked: boolean) => void
  error?: string
}

// Extracted from the staff ServicesSection so the public order form can
// reuse the exact same "2-column checkbox grid of active services" UI —
// purely presentational, no react-hook-form/useServicesSettings coupling.
export function ServiceCheckboxGrid({ services, selected, onToggle, error }: ServiceCheckboxGridProps) {
  // Active services, plus any already-selected one that's since been
  // disabled — an existing order (or an in-progress form) keeps showing
  // its selection rather than silently losing it from the list.
  const visibleServices = services.filter((s) => s.active || selected.includes(s.name))

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-700">
        What services do you require? <span className="text-danger">*</span>
      </p>
      {error && <p className="mb-2 text-xs font-medium text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        {visibleServices.map((service) => (
          <Checkbox
            key={service.id}
            id={`service-${service.id}`}
            label={service.name}
            checked={selected.includes(service.name)}
            onChange={(e) => onToggle(service.name, e.target.checked)}
          />
        ))}
      </div>
    </div>
  )
}
