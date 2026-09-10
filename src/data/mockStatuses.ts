import type {
  ArtworkStatus,
  GarmentStatus,
  PaymentStatus,
  Priority,
  ProductionStatus,
  Turnaround,
} from '@/types'

export interface StatusConfig<T extends string> {
  value: T
  label: string
  className: string
}

// Brand Fanatix UI refinement: consolidated from 11 different hues (red,
// amber, orange, emerald, sky, purple, indigo, teal, blue, cyan, zinc)
// down to one coherent 5-colour semantic system — the same tokens used
// everywhere else in the app (src/index.css). Every status badge now
// means one of exactly five things: neutral/not-started (zinc),
// needs-attention/blocked (danger), in-progress/partial (warning),
// done/good (success), or informational/queued (info). Text is always
// present alongside colour (StatusBadge never renders colour alone).
const NEUTRAL = 'bg-zinc-100 text-zinc-600 border-zinc-200'
const DANGER = 'bg-danger-soft text-danger border-danger/20'
const WARNING = 'bg-warning-soft text-warning border-warning/20'
const SUCCESS = 'bg-success-soft text-success border-success/20'
const INFO = 'bg-info-soft text-info border-info/20'

export const PAYMENT_STATUSES: StatusConfig<PaymentStatus>[] = [
  { value: 'Unpaid', label: 'Unpaid', className: DANGER },
  { value: 'Deposit Paid', label: 'Deposit Paid', className: WARNING },
  { value: 'Part Paid', label: 'Part Paid', className: WARNING },
  { value: 'Paid', label: 'Paid', className: SUCCESS },
  { value: 'On Account', label: 'On Account', className: INFO },
]

export const ARTWORK_STATUSES: StatusConfig<ArtworkStatus>[] = [
  { value: 'Not Started', label: 'Not Started', className: NEUTRAL },
  { value: 'Artwork To Do', label: 'Artwork To Do', className: WARNING },
  { value: 'Artwork Supplied', label: 'Artwork Supplied', className: INFO },
  { value: 'Need Artwork', label: 'Need Artwork', className: DANGER },
  { value: 'Need Vectored', label: 'Need Vectored', className: WARNING },
  { value: 'Mockup Required', label: 'Mockup Required', className: WARNING },
  { value: 'Awaiting Approval', label: 'Awaiting Approval', className: WARNING },
  { value: 'Approved', label: 'Approved', className: SUCCESS },
  { value: 'Completed', label: 'Completed', className: SUCCESS },
]

export const GARMENT_STATUSES: StatusConfig<GarmentStatus>[] = [
  { value: 'Not Required', label: 'Not Required', className: NEUTRAL },
  { value: 'Need Ordering', label: 'Need Ordering', className: DANGER },
  { value: 'Ordered', label: 'Ordered', className: INFO },
  { value: 'Follow Up', label: 'Follow Up', className: WARNING },
  { value: 'Part Received', label: 'Part Received', className: WARNING },
  { value: 'Supplied', label: 'Supplied', className: INFO },
  { value: 'Received', label: 'Received', className: SUCCESS },
  { value: 'Completed', label: 'Completed', className: SUCCESS },
]

export const PRODUCTION_STATUSES: StatusConfig<ProductionStatus>[] = [
  { value: 'New', label: 'New', className: NEUTRAL },
  { value: 'Ready', label: 'Ready', className: INFO },
  { value: 'Queued', label: 'Queued', className: INFO },
  { value: 'In Production', label: 'In Production', className: WARNING },
  { value: 'Quality Check', label: 'Quality Check', className: WARNING },
  { value: 'Ready for Collection', label: 'Ready for Collection', className: INFO },
  { value: 'Out for Delivery', label: 'Out for Delivery', className: INFO },
  { value: 'Completed', label: 'Completed', className: SUCCESS },
  { value: 'On Hold', label: 'On Hold', className: DANGER },
]

export const PRIORITIES: StatusConfig<Priority>[] = [
  { value: 'Normal', label: 'Normal', className: NEUTRAL },
  { value: 'High', label: 'High', className: WARNING },
  { value: 'Urgent', label: 'Urgent', className: DANGER },
]

export const TURNAROUNDS: StatusConfig<Turnaround>[] = [
  { value: 'Standard', label: 'Standard', className: NEUTRAL },
  { value: 'Rush', label: 'Rush', className: WARNING },
  { value: 'Same Day', label: 'Same Day', className: DANGER },
  { value: 'Custom', label: 'Custom', className: INFO },
]

export const TURNAROUND_DESCRIPTIONS: Record<Turnaround, string> = {
  Standard: 'Standard turnaround — 7–10 business days.',
  Rush: 'Expedited — 3 days, rush fee applies.',
  'Same Day': 'Production required today.',
  Custom: 'Manually set due date.',
}

function findConfig<T extends string>(
  list: StatusConfig<T>[],
  value: T,
): StatusConfig<T> {
  return list.find((s) => s.value === value) ?? list[0]
}

export const getPaymentStatusConfig = (v: PaymentStatus) => findConfig(PAYMENT_STATUSES, v)
export const getArtworkStatusConfig = (v: ArtworkStatus) => findConfig(ARTWORK_STATUSES, v)
export const getGarmentStatusConfig = (v: GarmentStatus) => findConfig(GARMENT_STATUSES, v)
export const getProductionStatusConfig = (v: ProductionStatus) => findConfig(PRODUCTION_STATUSES, v)
export const getPriorityConfig = (v: Priority) => findConfig(PRIORITIES, v)
export const getTurnaroundConfig = (v: Turnaround) => findConfig(TURNAROUNDS, v)
