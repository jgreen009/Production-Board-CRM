import { useState } from 'react'
import { PageHeader } from '@/components/domain/PageHeader'
import { OrderCard } from '@/components/domain/OrderCard'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { ProductionToolbar } from '@/components/domain/production/ProductionToolbar'
import { ProductionTable } from '@/components/domain/production/ProductionTable'
import { OrderQuickView } from '@/components/domain/production/OrderQuickView'
import { MockupPreviewDrawer } from '@/components/domain/production/MockupPreviewDrawer'
import { useProductionBoard } from '@/hooks/useProductionBoard'
import type { Order } from '@/types'
import { KanbanSquare } from 'lucide-react'

export default function ProductionBoard() {
  const board = useProductionBoard()
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null)

  return (
    <div>
      <PageHeader
        title="Production Board"
        description={`${board.totalCount} orders in the pipeline`}
      />

      <ProductionToolbar
        search={board.search}
        onSearchChange={board.setSearch}
        view={board.view}
        onViewChange={board.setView}
        filters={board.filters}
        onFilterChange={board.updateFilter}
        onResetFilters={board.resetFilters}
        sortKey={board.sortKey}
        onSortKeyChange={board.setSortKey}
        sortDir={board.sortDir}
        onSortDirChange={board.setSortDir}
        showDelivery={board.showDelivery}
        onShowDeliveryChange={board.setShowDelivery}
        resultCount={board.orders.length}
      />

      {board.isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <TableSkeleton />
        </div>
      ) : board.orders.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title={board.totalCount === 0 ? 'No orders yet' : 'No orders match these filters'}
          description={
            board.totalCount === 0
              ? 'Create your first order to see it here.'
              : 'Try adjusting the filters, search, or view tab.'
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <ProductionTable
              orders={board.orders}
              showDelivery={board.showDelivery}
              onRowClick={(order) => board.setSelectedOrderId(order.id)}
              onProductionStatusChange={board.updateProductionStatus}
              onPreviewClick={setPreviewOrder}
            />
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {board.orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={(o) => board.setSelectedOrderId(o.id)}
                extra={
                  <>
                    <StatusBadge kind="payment" value={order.paymentStatus} />
                    <StatusBadge kind="artwork" value={order.artworkStatus} />
                    <StatusBadge kind="garment" value={order.garmentStatus} />
                    <Badge className="border-zinc-200 bg-zinc-50 text-zinc-500">
                      {order.assignedTo ? order.assignedToName || 'Unnamed staff' : 'Unassigned'}
                    </Badge>
                  </>
                }
              />
            ))}
          </div>
        </>
      )}

      <OrderQuickView order={board.selectedOrder} onClose={() => board.setSelectedOrderId(null)} />
      <MockupPreviewDrawer order={previewOrder} onClose={() => setPreviewOrder(null)} />
    </div>
  )
}
