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

const badge = (className: string) => className

export const PAYMENT_STATUSES: StatusConfig<PaymentStatus>[] = [
  { value: 'Unpaid', label: 'Unpaid', className: badge('bg-red-50 text-red-700 border-red-200') },
  { value: 'Deposit Paid', label: 'Deposit Paid', className: badge('bg-amber-50 text-amber-700 border-amber-200') },
  { value: 'Part Paid', label: 'Part Paid', className: badge('bg-orange-50 text-orange-700 border-orange-200') },
  { value: 'Paid', label: 'Paid', className: badge('bg-emerald-50 text-emerald-700 border-emerald-200') },
  { value: 'On Account', label: 'On Account', className: badge('bg-sky-50 text-sky-700 border-sky-200') },
]

export const ARTWORK_STATUSES: StatusConfig<ArtworkStatus>[] = [
  { value: 'Not Started', label: 'Not Started', className: badge('bg-zinc-100 text-zinc-600 border-zinc-200') },
  { value: 'Artwork To Do', label: 'Artwork To Do', className: badge('bg-amber-50 text-amber-700 border-amber-200') },
  { value: 'Artwork Supplied', label: 'Artwork Supplied', className: badge('bg-sky-50 text-sky-700 border-sky-200') },
  { value: 'Need Artwork', label: 'Need Artwork', className: badge('bg-red-50 text-red-700 border-red-200') },
  { value: 'Need Vectored', label: 'Need Vectored', className: badge('bg-orange-50 text-orange-700 border-orange-200') },
  { value: 'Mockup Required', label: 'Mockup Required', className: badge('bg-purple-50 text-purple-700 border-purple-200') },
  { value: 'Awaiting Approval', label: 'Awaiting Approval', className: badge('bg-indigo-50 text-indigo-700 border-indigo-200') },
  { value: 'Approved', label: 'Approved', className: badge('bg-teal-50 text-teal-700 border-teal-200') },
  { value: 'Completed', label: 'Completed', className: badge('bg-emerald-50 text-emerald-700 border-emerald-200') },
]

export const GARMENT_STATUSES: StatusConfig<GarmentStatus>[] = [
  { value: 'Not Required', label: 'Not Required', className: badge('bg-zinc-100 text-zinc-600 border-zinc-200') },
  { value: 'Need Ordering', label: 'Need Ordering', className: badge('bg-red-50 text-red-700 border-red-200') },
  { value: 'Ordered', label: 'Ordered', className: badge('bg-sky-50 text-sky-700 border-sky-200') },
  { value: 'Follow Up', label: 'Follow Up', className: badge('bg-orange-50 text-orange-700 border-orange-200') },
  { value: 'Part Received', label: 'Part Received', className: badge('bg-amber-50 text-amber-700 border-amber-200') },
  { value: 'Supplied', label: 'Supplied', className: badge('bg-indigo-50 text-indigo-700 border-indigo-200') },
  { value: 'Received', label: 'Received', className: badge('bg-teal-50 text-teal-700 border-teal-200') },
  { value: 'Completed', label: 'Completed', className: badge('bg-emerald-50 text-emerald-700 border-emerald-200') },
]

export const PRODUCTION_STATUSES: StatusConfig<ProductionStatus>[] = [
  { value: 'New', label: 'New', className: badge('bg-zinc-100 text-zinc-600 border-zinc-200') },
  { value: 'Ready', label: 'Ready', className: badge('bg-sky-50 text-sky-700 border-sky-200') },
  { value: 'Queued', label: 'Queued', className: badge('bg-indigo-50 text-indigo-700 border-indigo-200') },
  { value: 'In Production', label: 'In Production', className: badge('bg-blue-50 text-blue-700 border-blue-200') },
  { value: 'Quality Check', label: 'Quality Check', className: badge('bg-purple-50 text-purple-700 border-purple-200') },
  { value: 'Ready for Collection', label: 'Ready for Collection', className: badge('bg-teal-50 text-teal-700 border-teal-200') },
  { value: 'Out for Delivery', label: 'Out for Delivery', className: badge('bg-cyan-50 text-cyan-700 border-cyan-200') },
  { value: 'Completed', label: 'Completed', className: badge('bg-emerald-50 text-emerald-700 border-emerald-200') },
  { value: 'On Hold', label: 'On Hold', className: badge('bg-red-50 text-red-700 border-red-200') },
]

export const PRIORITIES: StatusConfig<Priority>[] = [
  { value: 'Normal', label: 'Normal', className: badge('bg-zinc-100 text-zinc-600 border-zinc-200') },
  { value: 'High', label: 'High', className: badge('bg-amber-50 text-amber-700 border-amber-200') },
  { value: 'Urgent', label: 'Urgent', className: badge('bg-red-50 text-red-700 border-red-200') },
]

export const TURNAROUNDS: StatusConfig<Turnaround>[] = [
  { value: 'Standard', label: 'Standard', className: badge('bg-zinc-100 text-zinc-600 border-zinc-200') },
  { value: 'Rush', label: 'Rush', className: badge('bg-amber-50 text-amber-700 border-amber-200') },
  { value: 'Same Day', label: 'Same Day', className: badge('bg-red-50 text-red-700 border-red-200') },
  { value: 'Custom', label: 'Custom', className: badge('bg-sky-50 text-sky-700 border-sky-200') },
]

export const TURNAROUND_DESCRIPTIONS: Record<Turnaround, string> = {
  Standard: 'Standard turnaround — 5–10 working days.',
  Rush: 'Expedited — faster than standard turnaround, rush fee applies.',
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
