import { useMemo, useState } from 'react'
import type {
  ArtworkStatus,
  GarmentStatus,
  Priority,
  ProductionStatus,
} from '@/types'
import { useOrders, useUpdateProductionStatus } from '@/hooks/useOrders'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/components/ui/toast-context'
import { daysUntil } from '@/utils/date'
import { staffErrorMessage } from '@/utils/errorMessage'
import { isReadyForProduction } from '@/utils/productionReadiness'
import { compareQueueRank } from '@/utils/productionQueue'

export type BoardView =
  | 'all'
  | 'due-today'
  | 'upcoming'
  | 'urgent'
  | 'artwork-attention'
  | 'garment-followup'
  | 'completed'
  | 'my-orders'
  | 'unassigned'
  | 'ready-for-production'
  | 'awaiting-approval'

export const BOARD_VIEWS: { key: BoardView; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'my-orders', label: 'My Orders' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'due-today', label: 'Due Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'ready-for-production', label: 'Ready for Production' },
  { key: 'awaiting-approval', label: 'Awaiting Approval' },
  { key: 'artwork-attention', label: 'Artwork Attention' },
  { key: 'garment-followup', label: 'Garment Follow-Up' },
  { key: 'completed', label: 'Completed' },
]

const ARTWORK_ATTENTION: ArtworkStatus[] = [
  'Not Started',
  'Artwork To Do',
  'Need Artwork',
  'Need Vectored',
  'Mockup Required',
  'Awaiting Approval',
]

const GARMENT_FOLLOWUP: GarmentStatus[] = ['Need Ordering', 'Follow Up', 'Part Received']

export type SortKey = 'dueDate' | 'priority' | 'quantity' | 'createdAt' | 'queue'

const PRIORITY_RANK: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2 }

export interface BoardFilters {
  production: ProductionStatus | 'All'
  artwork: ArtworkStatus | 'All'
  garment: GarmentStatus | 'All'
  priority: Priority | 'All'
  due: 'All' | 'Overdue' | 'Today' | 'This Week'
}

const DEFAULT_FILTERS: BoardFilters = {
  production: 'All',
  artwork: 'All',
  garment: 'All',
  priority: 'All',
  due: 'All',
}

export function useProductionBoard() {
  const { data: orders = [], isLoading } = useOrders()
  const { data: currentProfile } = useProfile()
  const { showToast } = useToast()
  const updateProductionStatusMutation = useUpdateProductionStatus()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<BoardView>('all')
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)

  const updateProductionStatus = (orderId: string, status: ProductionStatus) => {
    updateProductionStatusMutation.mutate(
      { orderId, status },
      { onError: (err) => showToast(staffErrorMessage(err, "Couldn't update status — try again"), 'info') },
    )
  }

  const updateFilter = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  const filteredOrders = useMemo(() => {
    let result = orders

    switch (view) {
      case 'due-today':
        result = result.filter((o) => daysUntil(o.dueDate) === 0)
        break
      case 'upcoming':
        result = result.filter((o) => daysUntil(o.dueDate) >= 1 && daysUntil(o.dueDate) <= 7)
        break
      case 'urgent':
        result = result.filter((o) => o.priority === 'Urgent')
        break
      case 'my-orders':
        result = result.filter((o) => !!currentProfile && o.assignedTo === currentProfile.id)
        break
      case 'unassigned':
        result = result.filter((o) => !o.assignedTo)
        break
      case 'ready-for-production':
        result = result.filter((o) => isReadyForProduction(o))
        break
      case 'awaiting-approval':
        result = result.filter((o) => o.artworkStatus === 'Awaiting Approval')
        break
      case 'artwork-attention':
        result = result.filter((o) => ARTWORK_ATTENTION.includes(o.artworkStatus))
        break
      case 'garment-followup':
        result = result.filter((o) => GARMENT_FOLLOWUP.includes(o.garmentStatus))
        break
      case 'completed':
        result = result.filter((o) => o.productionStatus === 'Completed')
        break
    }

    if (filters.production !== 'All') result = result.filter((o) => o.productionStatus === filters.production)
    if (filters.artwork !== 'All') result = result.filter((o) => o.artworkStatus === filters.artwork)
    if (filters.garment !== 'All') result = result.filter((o) => o.garmentStatus === filters.garment)
    if (filters.priority !== 'All') result = result.filter((o) => o.priority === filters.priority)
    if (filters.due === 'Overdue') result = result.filter((o) => daysUntil(o.dueDate) < 0)
    if (filters.due === 'Today') result = result.filter((o) => daysUntil(o.dueDate) === 0)
    if (filters.due === 'This Week') result = result.filter((o) => daysUntil(o.dueDate) >= 0 && daysUntil(o.dueDate) <= 7)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.jobName.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q),
      )
    }

    const sorted = [...result].sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'dueDate':
          diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case 'priority':
          diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          break
        case 'quantity':
          diff = a.quantity - b.quantity
          break
        case 'createdAt':
          diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'queue':
          diff = compareQueueRank(a, b)
          break
      }
      return sortDir === 'asc' ? diff : -diff
    })

    return sorted
  }, [orders, view, filters, search, sortKey, sortDir, currentProfile])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null

  return {
    orders: filteredOrders,
    totalCount: orders.length,
    isLoading,
    search,
    setSearch,
    view,
    setView,
    filters,
    updateFilter,
    resetFilters,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    selectedOrder,
    setSelectedOrderId,
    updateProductionStatus,
    showDelivery,
    setShowDelivery,
  }
}
