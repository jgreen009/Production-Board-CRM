import type { ArtworkStatus, GarmentStatus, Order, PrintSpec } from '@/types'
import { daysUntil, isOverdue } from '@/utils/date'
import { selectPrimaryPrintSpec } from '@/api/mappers/printSpec'

// Phase 3 Batch C — centralized, pure derived-state helpers so Production
// Board, Dashboard, Order Detail, and Quick View can never disagree about
// what "ready" or "needs attention" means. Every `Order` passed in is
// assumed Active (listOrders/getOrder both already scope to
// order_state = 'Active' — drafts never reach these surfaces), so
// readiness/attention logic doesn't re-check order state itself.
//
// These are DERIVED indicators only — none of them write anything back to
// the order. Staff still control ArtworkStatus/GarmentStatus/
// ProductionStatus by hand; nothing here mutates those automatically.

const ARTWORK_READY: ArtworkStatus[] = ['Approved', 'Completed']
const GARMENT_READY: GarmentStatus[] = ['Received', 'Supplied', 'Completed', 'Not Required']

function isArtworkReady(status: ArtworkStatus): boolean {
  return ARTWORK_READY.includes(status)
}

function isGarmentReady(status: GarmentStatus): boolean {
  return GARMENT_READY.includes(status)
}

// Recommended criteria (Batch C §"Production Readiness"): artwork
// approved/completed, garments received/supplied/completed/not-required,
// and production not already completed. Payment status is deliberately
// NOT a readiness input — payment stays tracking-only per Batch C.
export function isReadyForProduction(order: Order): boolean {
  return isArtworkReady(order.artworkStatus) && isGarmentReady(order.garmentStatus) && order.productionStatus !== 'Completed'
}

// The human-readable reasons behind a `false` isReadyForProduction result —
// shown instead of a bare "Not Ready" wherever the plan calls for it (Order
// Detail Production tab, Quick View).
export function getProductionBlockers(order: Order): string[] {
  const blockers: string[] = []
  if (!isArtworkReady(order.artworkStatus)) blockers.push('Artwork approval required')
  if (!isGarmentReady(order.garmentStatus)) blockers.push('Garments not ready')
  if (order.productionStatus === 'Completed') blockers.push('Production already completed')
  return blockers
}

export type WarningSeverity = 'critical' | 'warning' | 'info'

export interface AttentionWarning {
  severity: WarningSeverity
  message: string
}

const SEVERITY_RANK: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 }

// Lower rank = more severe = sorts first. Used both for board/dashboard
// ordering and for picking the single "headline" warning to show
// somewhere with room for only one line (e.g. Dashboard's existing
// Orders Requiring Attention list).
export function compareWarningSeverity(a: AttentionWarning, b: AttentionWarning): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
}

// Pure, deterministic, no automation — every rule reads only fields
// already on the order. A finished job (productionStatus === 'Completed')
// never needs attention, regardless of how overdue/artwork-incomplete it
// technically looks on paper (Batch C acceptance test C12).
export function getAttentionWarnings(order: Order): AttentionWarning[] {
  if (order.productionStatus === 'Completed') return []

  const warnings: AttentionWarning[] = []
  const overdue = isOverdue(order.dueDate)
  const diff = daysUntil(order.dueDate)
  const dueToday = diff === 0
  const dueTomorrow = diff === 1
  const artworkIncomplete = !isArtworkReady(order.artworkStatus)

  if (overdue) {
    warnings.push({ severity: 'critical', message: 'Order overdue' })
  }

  if (order.turnaroundType === 'Same Day' && artworkIncomplete) {
    warnings.push({ severity: 'critical', message: 'Same-day order — artwork incomplete' })
  }

  if (dueToday && artworkIncomplete) {
    warnings.push({ severity: 'critical', message: 'Due today — artwork not approved' })
  } else if (dueTomorrow && artworkIncomplete) {
    warnings.push({ severity: 'warning', message: 'Due tomorrow — artwork not approved' })
  }

  if (order.priority === 'Urgent' && !isGarmentReady(order.garmentStatus)) {
    warnings.push({ severity: 'warning', message: 'Urgent — garments not ready' })
  }

  // "Approval required before due date" — distinct from the artwork-
  // incomplete rules above: this fires specifically while a mockup is
  // sitting in Awaiting Approval (i.e. work is done, just needs a
  // decision) rather than while artwork is still missing/in progress.
  if (order.artworkStatus === 'Awaiting Approval' && !overdue && diff <= 3) {
    warnings.push({ severity: diff <= 1 ? 'warning' : 'info', message: 'Approval required before due date' })
  }

  return [...warnings].sort(compareWarningSeverity)
}

// Batch B established selectPrimaryPrintSpec(specs); this is the
// order-level convenience the brief names explicitly, so call sites don't
// need to know PrintSpec selection is really an array operation.
export function selectPrimaryMockup(order: Order): PrintSpec | undefined {
  return selectPrimaryPrintSpec(order.printSpecs)
}
