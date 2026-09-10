import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { orderFormSchema } from '@/schemas/orderFormSchema'
import type { OrderFormValues } from '@/schemas/orderFormSchema'
import type { Order } from '@/types'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { buildReorderFormValues } from '@/pages/new-order/reorder'
import { useUpdateOrderWithActivity, useUpsertOrder, useOrder, useOrderFormValues } from '@/hooks/useOrders'
import { useActiveStaff } from '@/hooks/useStaff'
import { logReorderActivity } from '@/api/orders'
import { uploadArtwork, copyReferencedArtworkForReorder } from '@/api/artwork'
import { useToast } from '@/components/ui/toast-context'
import { orderSaveErrorMessage } from '@/utils/errorMessage'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderSummary } from '@/components/domain/OrderSummary'
import { CustomerJobSection } from '@/pages/new-order/sections/CustomerJobSection'
import { TurnaroundDeliverySection } from '@/pages/new-order/sections/TurnaroundDeliverySection'
import { ServicesSection } from '@/pages/new-order/sections/ServicesSection'
import { GarmentStylesSection } from '@/pages/new-order/sections/GarmentStylesSection'
import { PaymentAndNotesSection } from '@/pages/new-order/sections/PaymentAndNotesSection'

export type OrderFormMode = 'create' | 'edit-active'

interface ReorderSource {
  orderId: string
  orderNumber: string
}

interface OrderFormEditorProps {
  // Present for edit-active only — a brand-new order never has one until
  // Create Order actually succeeds; there is no draft/resume state that
  // would give it one any earlier.
  orderId?: string
  initialValues?: OrderFormValues
  // Only used (and only needed) in edit-active mode, for the activity diff.
  previousOrder?: Order
  mode?: OrderFormMode
  // Phase 4 Milestone 5 — present only when this "create" is a Reorder.
  // Drives the source banner and the one-time artwork-copy step on first save.
  reorderFrom?: ReorderSource
}

// The actual form — reused by /orders/new (mode: create) and
// EditOrderForm (mode: edit-active). One form, per spec §11.
//
// Product decision: Create Order is the ONLY action that ever creates an
// order. Nothing autosaves, nothing is saved as a resumable draft — not
// locally, not in the database. A brand-new order form holds everything
// (including any selected artwork, held as an in-memory File — see
// ArtworkSection.tsx) purely in local component/form state until Create
// Order is clicked; if the tab is closed or refreshed before that, nothing
// was ever written anywhere, by design.
export function OrderFormEditor({ orderId: existingOrderId, initialValues, previousOrder, mode = 'create', reorderFrom }: OrderFormEditorProps) {
  const isEditingActive = mode === 'edit-active'
  const navigate = useNavigate()
  const { showToast } = useToast()
  const upsertOrder = useUpsertOrder()
  const updateOrderWithActivity = useUpdateOrderWithActivity()
  const { data: activeStaff = [] } = useActiveStaff()

  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? null)
  const orderIdRef = useRef<string | null>(existingOrderId ?? null)
  // Guards the one-time reorder-artwork-copy step so it can only ever fire
  // once per mount.
  const reorderArtworkCopiedRef = useRef(false)
  // True for the whole "create the order, then attach its artwork" span
  // (shell save + any uploads/copies + the final save) — upsertOrder's own
  // isPending flag alone goes false in the gaps between those calls, which
  // would otherwise let a double-click sneak a second Create Order
  // submission in while that's still running.
  const [createInFlight, setCreateInFlight] = useState(false)

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialValues ?? defaultOrderFormValues(),
    mode: 'onSubmit',
  })

  // The ONE save path — Create Order (or Save Changes, for an edit) calls
  // this and nothing else does. For a brand-new order (orderId still
  // null), it may additionally need to:
  //  - copy a Reorder's source artwork into the new order, or
  //  - upload whatever artwork files were selected before Create Order was
  //    clicked (held as in-memory Files — see ArtworkSection.tsx) — since
  //    no order existed for them to attach to until right now.
  // Either case needs the same shape: create the order shell with every
  // print spec's artworkId stripped (so no row ever references artwork
  // that doesn't exist in this order yet, even momentarily), attach the
  // real artwork, remap the print specs' artworkId to the real rows, then
  // perform the actual finalize the caller asked for. Neither step runs
  // more than once per mount (reorderArtworkCopiedRef / orderIdRef).
  const runSaveNow = async (values: OrderFormValues, finalize: boolean, generatePreviews?: boolean): Promise<string> => {
    const needsReorderArtworkCopy = !!reorderFrom && !orderIdRef.current && !reorderArtworkCopiedRef.current
    const pendingArtwork = values.artworkFiles.filter((f) => f.pendingFile)
    const needsPendingUpload = !orderIdRef.current && !needsReorderArtworkCopy && pendingArtwork.length > 0

    if (!needsReorderArtworkCopy && !needsPendingUpload) {
      return upsertOrder.mutateAsync({ values, orderId: orderIdRef.current, finalize, generatePreviews })
    }

    if (needsReorderArtworkCopy) {
      reorderArtworkCopiedRef.current = true
      const shellId = await upsertOrder.mutateAsync({
        values: { ...values, printSpecs: values.printSpecs.map((s) => ({ ...s, artworkId: undefined })), artworkFiles: [] },
        orderId: null,
        finalize: false,
      })
      orderIdRef.current = shellId
      setOrderId(shellId)

      const { artworkFiles: newArtworkFiles, artworkIdMap } = await copyReferencedArtworkForReorder(
        shellId,
        values.artworkFiles,
        values.printSpecs,
      )
      const remappedPrintSpecs = values.printSpecs.map((s) => ({
        ...s,
        artworkId: s.artworkId ? artworkIdMap.get(s.artworkId) : undefined,
      }))
      const remappedValues: OrderFormValues = { ...values, artworkFiles: newArtworkFiles, printSpecs: remappedPrintSpecs }

      methods.setValue('artworkFiles', remappedValues.artworkFiles)
      methods.setValue('printSpecs', remappedValues.printSpecs)

      await logReorderActivity(shellId, reorderFrom!.orderNumber)

      return upsertOrder.mutateAsync({ values: remappedValues, orderId: shellId, finalize, generatePreviews })
    }

    // needsPendingUpload: a plain new order (not a Reorder) with artwork
    // selected before the order existed. Same shell-then-attach shape.
    const shellId = await upsertOrder.mutateAsync({
      values: { ...values, printSpecs: values.printSpecs.map((s) => ({ ...s, artworkId: undefined })), artworkFiles: [] },
      orderId: null,
      finalize: false,
    })
    orderIdRef.current = shellId
    setOrderId(shellId)

    const idMap = new Map<string, string>()
    const newArtworkFiles = await Promise.all(
      values.artworkFiles.map(async (f) => {
        if (!f.pendingFile) return f
        const uploaded = await uploadArtwork(shellId, f.pendingFile)
        idMap.set(f.id, uploaded.id)
        return {
          id: uploaded.id,
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          sizeKb: uploaded.sizeKb,
          previewUrl: f.previewUrl,
          storagePath: uploaded.storagePath,
        }
      }),
    )
    const remappedPrintSpecs = values.printSpecs.map((s) => ({
      ...s,
      artworkId: s.artworkId ? (idMap.get(s.artworkId) ?? s.artworkId) : undefined,
    }))
    const remappedValues: OrderFormValues = { ...values, artworkFiles: newArtworkFiles, printSpecs: remappedPrintSpecs }

    methods.setValue('artworkFiles', remappedValues.artworkFiles)
    methods.setValue('printSpecs', remappedValues.printSpecs)

    return upsertOrder.mutateAsync({ values: remappedValues, orderId: shellId, finalize, generatePreviews })
  }

  // Serializes every call to runSaveNow — in practice now just Create
  // Order/Save Changes itself, but kept so a double-click or a fast
  // double-submit can never fire two overlapping upsert_order calls for
  // the same order (the actual cause of a live, intermittent "Failed to
  // create order" — confirmed via Supabase's edge logs showing alternating
  // 200/409 responses to rpc/upsert_order: two overlapping calls each
  // delete-then-reinsert print_specs/order_garments/order_services using
  // the same client-generated ids, and whichever INSERT lost the race hit
  // a primary key).
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const performSave = (values: OrderFormValues, finalize: boolean, generatePreviews?: boolean): Promise<string> => {
    const queued = saveQueueRef.current.catch(() => {}).then(() => runSaveNow(values, finalize, generatePreviews))
    saveQueueRef.current = queued.catch(() => {})
    return queued
  }

  const onSubmit = async (values: OrderFormValues) => {
    setCreateInFlight(true)
    try {
      if (isEditingActive && previousOrder) {
        const newAssigneeName = values.assignedTo
          ? (activeStaff.find((s) => s.id === values.assignedTo)?.fullName ?? null)
          : null
        const id = await updateOrderWithActivity.mutateAsync({
          values,
          orderId: existingOrderId!,
          previous: previousOrder,
          newAssigneeName,
        })
        showToast('Order updated', 'success')
        navigate(`/orders/${id}`)
      } else {
        const id = await performSave(values, true, true)
        showToast('Order created', 'success')
        navigate(`/orders/${id}`)
      }
    } catch (err) {
      showToast(orderSaveErrorMessage(err, isEditingActive ? 'Failed to save changes' : 'Failed to create order'), 'info')
    } finally {
      setCreateInFlight(false)
    }
  }

  const onInvalid = () => {
    showToast('Please fix the highlighted fields before saving.', 'info')
  }

  const submitting = isEditingActive ? updateOrderWithActivity.isPending : upsertOrder.isPending || createInFlight
  const heading = isEditingActive ? 'Edit Order' : 'New Order'
  const description = isEditingActive
    ? "Update this order's production specification."
    : 'Digital production specification for a new Brand Fanatix job.'

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)}>
        {reorderFrom && (
          <Card className="mb-4 flex flex-col gap-2 border-indigo-200 bg-indigo-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-sm text-indigo-800">
              <RefreshCw size={14} /> Reorder from <span className="font-medium">{reorderFrom.orderNumber}</span> — review before saving.
            </p>
            <Link
              to="/customers"
              className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900"
            >
              <ArrowLeft size={12} /> Cancel Reorder
            </Link>
          </Card>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{heading}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="submit" variant="primary" disabled={submitting}>
              {isEditingActive ? (submitting ? 'Saving...' : 'Save Changes') : submitting ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <CustomerJobSection />
            <TurnaroundDeliverySection />
            <ServicesSection />
            <GarmentStylesSection orderId={orderId} />
            <PaymentAndNotesSection
              currentAssigneeName={previousOrder?.assignedToName}
              currentAssigneeActive={previousOrder?.assignedToActive}
            />
          </div>

          <div className="lg:sticky lg:top-20 lg:h-fit">
            <OrderSummary
              values={methods.watch()}
              submitting={submitting}
              submitLabel={isEditingActive ? 'Save Changes' : 'Create Order'}
              productionStatus={previousOrder?.productionStatus}
            />
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

// Route-level wrapper for /orders/new. Plain new order by default; if a
// ?reorderFrom=<id> query param is present, fetches and rebuilds the
// source order into a fresh reorder form instead (a plain URL param, not
// router state carrying the whole order, so a refresh before the first
// save just re-fetches and rebuilds rather than losing the reorder
// entirely). Nothing is written to the database merely by opening this
// URL — buildReorderFormValues is pure, and the first actual write only
// happens on Create Order (see performSave above). There is no ?draft=
// param any more — a brand-new order is never persisted before Create
// Order is clicked, so there is nothing to resume.
export default function NewOrderForm() {
  const [searchParams] = useSearchParams()
  const reorderFromId = searchParams.get('reorderFrom') ?? undefined
  const { data: reorderSourceOrder, isLoading: reorderOrderLoading } = useOrder(reorderFromId)
  const { data: reorderSourceValues, isLoading: reorderValuesLoading } = useOrderFormValues(reorderFromId)

  if (reorderFromId) {
    if (reorderOrderLoading || reorderValuesLoading) {
      return <p className="p-4 text-sm text-zinc-400">Preparing reorder...</p>
    }
    if (!reorderSourceOrder || !reorderSourceValues) {
      return (
        <EmptyState
          title="Couldn't load the order to reorder"
          description="It may have been removed, or the link is out of date."
          action={<Link to="/customers" className="text-sm font-medium text-zinc-700 hover:underline">Back to Customers</Link>}
        />
      )
    }
    return (
      <OrderFormEditor
        mode="create"
        initialValues={buildReorderFormValues(reorderSourceValues)}
        reorderFrom={{ orderId: reorderSourceOrder.id, orderNumber: reorderSourceOrder.orderNumber }}
      />
    )
  }

  return <OrderFormEditor mode="create" />
}
