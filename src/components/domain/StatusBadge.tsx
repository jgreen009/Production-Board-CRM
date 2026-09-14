import { clsx } from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { useAllStatusOptionsByDimension } from '@/hooks/useStatusOptions'
import type {
  ArtworkStatus,
  GarmentStatus,
  PaymentStatus,
  Priority,
  ProductionStatus,
  Turnaround,
} from '@/types'

type StatusKind =
  | { kind: 'payment'; value: PaymentStatus }
  | { kind: 'artwork'; value: ArtworkStatus }
  | { kind: 'garment'; value: GarmentStatus }
  | { kind: 'production'; value: ProductionStatus }
  | { kind: 'priority'; value: Priority }
  | { kind: 'turnaround'; value: Turnaround }

// Includes inactive statuses — an order already set to a since-deactivated
// status must still render a real label/colour, not fall through to a
// generic placeholder (the DB trigger explicitly keeps such values valid).
export function StatusBadge(props: StatusKind & { className?: string }) {
  const options = useAllStatusOptionsByDimension(props.kind)
  const config = options.find((o) => o.value === props.value) ?? { label: props.value, className: 'bg-zinc-100 text-zinc-600 border-zinc-200' }

  return <Badge className={clsx(config.className, props.className)}>{config.label}</Badge>
}
