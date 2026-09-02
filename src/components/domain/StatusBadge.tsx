import { clsx } from 'clsx'
import { Badge } from '@/components/ui/Badge'
import {
  getArtworkStatusConfig,
  getGarmentStatusConfig,
  getPaymentStatusConfig,
  getPriorityConfig,
  getProductionStatusConfig,
  getTurnaroundConfig,
} from '@/data/mockStatuses'
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

export function StatusBadge(props: StatusKind & { className?: string }) {
  const config = (() => {
    switch (props.kind) {
      case 'payment':
        return getPaymentStatusConfig(props.value)
      case 'artwork':
        return getArtworkStatusConfig(props.value)
      case 'garment':
        return getGarmentStatusConfig(props.value)
      case 'production':
        return getProductionStatusConfig(props.value)
      case 'priority':
        return getPriorityConfig(props.value)
      case 'turnaround':
        return getTurnaroundConfig(props.value)
    }
  })()

  return <Badge className={clsx(config.className, props.className)}>{config.label}</Badge>
}
