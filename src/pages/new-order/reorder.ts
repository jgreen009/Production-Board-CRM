import type { OrderFormValues } from '@/schemas/orderFormSchema'
import { defaultOrderFormValues } from '@/pages/new-order/defaultValues'
import { generateId } from '@/utils/id'

// Phase 4 Milestone 5 — the pure half of Reorder. Takes the SOURCE order's
// existing form-shaped data (the same OrderFormValues Edit Order already
// hydrates via getOrderFormValues — reusing that instead of a bespoke
// Order+PrintSpec[] shape, per the "smallest equivalent shape needed by
// the existing form architecture" allowance) and returns a fresh
// OrderFormValues ready for a brand-new order.
//
// This function does NOT touch the network, Storage, or artwork rows —
// artworkFiles/printSpecs here still carry the SOURCE order's artwork ids
// and Storage paths unchanged, purely so the reorder form can render real
// preview thumbnails while staff reviews it. The actual artwork copy (new
// Storage objects, new artwork rows, id remapping) happens later, exactly
// once, at the moment of the reorder's first real save — see
// copyReferencedArtworkForReorder in src/api/artwork.ts and its use in
// NewOrderForm.tsx. Keeping that entirely out of this function is what
// keeps it pure and this cheaply/exhaustively unit-testable.
//
// Built as `{ ...defaultOrderFormValues(), ...copiedFields }` (the
// approved pattern) rather than restating every field by hand, so future
// schema additions default-safely unless explicitly listed as COPY here.
export function buildReorderFormValues(source: OrderFormValues): OrderFormValues {
  const defaults = defaultOrderFormValues()

  return {
    ...defaults,

    // RESET, explicitly — defaultOrderFormValues() itself defaults dueDate
    // to 7 days out (a sensible starting point for a genuinely new order),
    // which is NOT the same as reorder's required blank reset. Staff
    // chooses a new due date; it is never derived from the source.
    dueDate: '',

    // COPY — the actual point of a repeat order: recreate the job.
    customerId: source.customerId,
    newCustomerName: source.newCustomerName,
    jobName: source.jobName,
    email: source.email,
    phone: source.phone,
    rushFee: source.rushFee,
    turnaround: source.turnaround,
    deliveryMethod: source.deliveryMethod,
    priority: source.priority,
    services: [...source.services],
    suppliesGarments: source.suppliesGarments,
    graphicDesignServices: source.graphicDesignServices,
    specialisedApplication: source.specialisedApplication,
    specialisedApplicationDetails: source.specialisedApplicationDetails,

    // Deep-cloned (not just spread) so nothing in the new order's form
    // state can ever share a reference with — and accidentally mutate —
    // the source order's own data. Fresh client-side ids: nothing server-
    // side reads a client-sent garment id (upsert_order always generates
    // its own), so this is just hygiene, not a functional requirement.
    garments: source.garments.map((g) => ({
      ...g,
      id: generateId('garment'),
      adultQuantities: { ...g.adultQuantities },
      youthQuantities: { ...g.youthQuantities },
    })),

    // Still pointing at the SOURCE artwork/Storage paths — display-only
    // until the first save's artwork-copy step remaps them. See the file
    // header comment.
    artworkFiles: source.artworkFiles.map((f) => ({ ...f })),

    // REGENERATE id (a real, save-ready UUID — the same
    // crypto.randomUUID() mechanism emptyPrintSpec() already uses, never
    // an array index or temporary string). RESET previewStoragePath and
    // approvalNote — both belong to the source's own approval/preview
    // cycle, never carried into a new one. artworkId is left pointing at
    // the source artwork for now; remapped at save time alongside
    // artworkFiles above.
    printSpecs: source.printSpecs.map((spec) => ({
      ...spec,
      id: crypto.randomUUID(),
      previewStoragePath: undefined,
      approvalNote: undefined,
    })),

    // Everything else — dueDate, paymentStatus, productionNotes, notes,
    // staffCompleted, assignedTo, orderDate — is left at
    // defaultOrderFormValues()'s own values (blank due date, Unpaid,
    // empty notes, false, unassigned, today) by simply not overriding
    // them here. This is the RESET half of the matrix, achieved by
    // omission rather than restating every reset field by hand.
  }
}
