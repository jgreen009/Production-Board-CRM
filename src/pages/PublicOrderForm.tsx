import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ImageOff, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { OrderFormSection } from '@/components/domain/OrderFormSection'
import { GarmentCard, type GarmentCardValues, type GarmentCatalogEntry } from '@/components/domain/GarmentCard'
import { ServiceCheckboxGrid } from '@/components/domain/ServiceCheckboxGrid'
import { PublicPrintDetailsSection } from '@/pages/PublicPrintDetailsSection'
import { ensureDefaultPrintSpec, syncPrintSpecsToEffectiveGarment } from '@/pages/publicPrintSpecDefaults'
import { validatePublicOrderLink, submitPublicOrder } from '@/api/publicOrder'
import type { PublicLinkInvalidReason, PublicGarmentTypeOption, PublicServiceOption } from '@/api/publicOrder'
import type { PublicOrderFormValues } from '@/schemas/publicOrderFormSchema'
import { publicOrderFormSchema } from '@/schemas/publicOrderFormSchema'

// Public Customer Order Link — a fully anonymous, chrome-free page (no
// AppShell/sidebar, no RequireAuth — see src/App.tsx). Sections 3-5
// (Services / Garments / Artwork & Print) deliberately reuse the exact
// same components the internal Staff Order Form uses
// (ServiceCheckboxGrid, GarmentCard, and the Mockup Studio's shared
// PrintPositionButtons/PrintSizePresetButtons/ArtworkSelector/PrintSpecTabs)
// rather than a second, separately-styled implementation — see
// docs/PUBLIC_ORDER_LINK_HANDOVER.md for the full component-sharing
// strategy. The mockup preview is the lightweight non-Fabric GarmentMockup
// renderer, always visible as part of the normal section layout — there
// is no button/toggle anywhere that reveals it.

let idCounter = 0
function localId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}-${Date.now()}`
}

function emptyGarment(): GarmentCardValues {
  return { id: localId('garment'), type: '', brand: '', colour: '', sizing: 'Adult', adultQuantities: {}, youthQuantities: {} }
}

type Stage = 'loading' | 'invalid' | 'form' | 'submitting' | 'success' | 'error'

const INVALID_MESSAGES: Record<PublicLinkInvalidReason, string> = {
  not_found: 'This order link is invalid. Please check the link or contact us for a new one.',
  revoked: 'This order link is no longer available.',
  expired: 'This order link has expired. Please contact us for a new one.',
  used: 'This order link has already been used.',
}

export default function PublicOrderForm() {
  const { token = '' } = useParams<{ token: string }>()
  const [stage, setStage] = useState<Stage>('loading')
  const [invalidReason, setInvalidReason] = useState<PublicLinkInvalidReason>('not_found')
  const [businessName, setBusinessName] = useState('Brand Fanatix')
  const [garmentTypes, setGarmentTypes] = useState<PublicGarmentTypeOption[]>([])
  const [garmentBrands, setGarmentBrands] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<PublicServiceOption[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [activeSpecId, setActiveSpecId] = useState<string>('')

  const [values, setValues] = useState<PublicOrderFormValues>({
    customerName: '',
    company: '',
    email: '',
    phone: '',
    jobTitle: '',
    dueDate: '',
    deliveryMethod: 'Pick Up',
    services: [],
    garments: [emptyGarment()],
    artworkFiles: [],
    printSpecs: [],
    notes: '',
  })

  useEffect(() => {
    let cancelled = false
    validatePublicOrderLink(token)
      .then((result) => {
        if (cancelled) return
        if (!result.valid) {
          setInvalidReason(result.reason ?? 'not_found')
          setStage('invalid')
          return
        }
        setBusinessName(result.businessName)
        setGarmentTypes(result.garmentTypes)
        setGarmentBrands(result.garmentBrands)
        setAvailableServices(result.services)
        setStage('form')
      })
      .catch(() => {
        if (!cancelled) setStage('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const update = (patch: Partial<PublicOrderFormValues>) => setValues((v) => ({ ...v, ...patch }))

  const updateGarment = (index: number, updated: GarmentCardValues) =>
    update({ garments: values.garments.map((g, i) => (i === index ? updated : g)) })

  const addGarment = () => update({ garments: [...values.garments, emptyGarment()] })
  const removeGarment = (index: number) => {
    if (values.garments.length <= 1) return
    update({ garments: values.garments.filter((_, i) => i !== index) })
  }

  const toggleService = (name: string, checked: boolean) =>
    update({ services: checked ? [...values.services, name] : values.services.filter((s) => s !== name) })

  // Garments section is the single source of truth for what the mockup
  // preview shows (matching the staff Mockup Studio's own convention
  // exactly — see MockupStudio.tsx's identical comment) — the first
  // garment's type/colour, not a separate per-print-location selector.
  const effectiveGarmentType = values.garments[0]?.type || ''
  const effectiveColour = values.garments[0]?.colour || ''

  // A brand-new form starts with zero print locations — without this, the
  // preview never appears at all until the customer notices a manual "Add
  // Print Location" action. As soon as a garment type is chosen, seed one
  // default print location automatically so GarmentPreview is visible
  // immediately, matching "visible by default, no reveal button" exactly.
  // (Pure decision logic lives in ensureDefaultPrintSpec, directly unit
  // tested — this effect just applies whatever it decides.)
  useEffect(() => {
    const result = ensureDefaultPrintSpec(values.printSpecs, effectiveGarmentType, effectiveColour, activeSpecId)
    if (!result.changed) return
    update({ printSpecs: result.printSpecs })
    setActiveSpecId(result.activeSpecId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveGarmentType])

  // Keeps every print location's snapshotted garmentType/garmentColour in
  // sync with garments[0] as the customer edits it — mirrors how the
  // staff form treats garments[0] as the live source of truth rather than
  // a value copied once and left to go stale. (Pure sync logic lives in
  // syncPrintSpecsToEffectiveGarment, directly unit tested.)
  useEffect(() => {
    const synced = syncPrintSpecsToEffectiveGarment(values.printSpecs, effectiveGarmentType, effectiveColour)
    if (synced !== values.printSpecs) update({ printSpecs: synced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveGarmentType, effectiveColour])

  const [reviewing, setReviewing] = useState(false)

  const handleReview = () => {
    const result = publicOrderFormSchema.safeParse(values)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setReviewing(true)
  }

  const handleSubmit = async () => {
    setStage('submitting')
    setSubmitError(null)
    try {
      const result = await submitPublicOrder(token, values)
      setOrderNumber(result.orderNumber)
      setStage('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'We could not submit your order. Please try again.')
      setStage('form')
      setReviewing(false)
    }
  }

  const totalGarments = useMemo(
    () =>
      values.garments.reduce(
        (sum, g) =>
          sum +
          Object.values(g.adultQuantities).reduce((a, b) => a + b, 0) +
          Object.values(g.youthQuantities).reduce((a, b) => a + b, 0),
        0,
      ),
    [values.garments],
  )

  const garmentTypeEntries: GarmentCatalogEntry[] = garmentTypes.map((g) => ({ name: g.name, active: true, supplierUrl: g.supplierUrl }))
  const garmentBrandEntries: GarmentCatalogEntry[] = garmentBrands.map((name) => ({ name, active: true }))

  if (stage === 'loading') {
    return (
      <PublicShell businessName="Brand Fanatix">
        <div className="flex flex-col items-center gap-2 py-16 text-zinc-400">
          <Loader2 className="animate-spin" size={24} />
          <p className="text-sm">Loading order form…</p>
        </div>
      </PublicShell>
    )
  }

  if (stage === 'invalid') {
    return (
      <PublicShell businessName="Brand Fanatix">
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
            <ImageOff className="text-zinc-300" size={28} />
            <p className="text-sm font-medium text-zinc-700">{INVALID_MESSAGES[invalidReason]}</p>
          </CardBody>
        </Card>
      </PublicShell>
    )
  }

  if (stage === 'success' && orderNumber) {
    return (
      <PublicShell businessName={businessName}>
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="text-success" size={32} />
            <p className="text-base font-semibold text-zinc-800">Thanks — your order request has been submitted.</p>
            <p className="text-sm text-zinc-500">
              Order Number: <span className="font-semibold text-zinc-800">{orderNumber}</span>
            </p>
            <p className="max-w-sm text-xs text-zinc-400">
              {businessName} will review the order and contact you if anything needs clarification.
            </p>
          </CardBody>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell businessName={businessName}>
      {reviewing ? (
        <ReviewSection
          values={values}
          totalGarments={totalGarments}
          submitting={stage === 'submitting'}
          submitError={submitError}
          onEdit={() => setReviewing(false)}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <OrderFormSection step={1} title="Your Details">
            <div className="grid grid-cols-1 gap-3">
              <FormField label="Your Name" required error={errors.customerName}>
                <Input value={values.customerName} onChange={(e) => update({ customerName: e.target.value })} placeholder="Jane Smith" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Email" error={errors.email}>
                  <Input type="email" value={values.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" />
                </FormField>
                <FormField label="Phone">
                  <Input value={values.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="04xx xxx xxx" />
                </FormField>
              </div>
              <FormField label="Business / Company Name">
                <Input value={values.company} onChange={(e) => update({ company: e.target.value })} placeholder="Optional" />
              </FormField>
            </div>
          </OrderFormSection>

          <OrderFormSection step={2} title="Job / Turnaround / Delivery">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Job / Order Title">
                <Input value={values.jobTitle} onChange={(e) => update({ jobTitle: e.target.value })} placeholder="e.g. Team Tees 2026" />
              </FormField>
              <FormField label="Required Date">
                <Input type="date" value={values.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
              </FormField>
            </div>
            <div className="flex gap-1.5">
              {(['Pick Up', 'Delivery'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => update({ deliveryMethod: method })}
                  className={`min-h-10 rounded-md border px-3 py-2 text-sm font-medium ${
                    values.deliveryMethod === method
                      ? 'border-brand-accent bg-brand-accent-soft text-brand-accent'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </OrderFormSection>

          <OrderFormSection step={3} title="Services Required" description="Matches the paper form's checkbox list, in the same order.">
            <ServiceCheckboxGrid
              services={availableServices.map((s) => ({ ...s, active: true }))}
              selected={values.services}
              onToggle={toggleService}
              error={errors.services}
            />
          </OrderFormSection>

          <OrderFormSection step={4} title="Garments & Styles" description="One card per garment type — type, brand, colour, and quantities.">
            {errors.garments && <p className="mb-2 text-xs font-medium text-danger">{errors.garments}</p>}
            <div className="flex flex-col gap-3">
              {values.garments.map((garment, i) => (
                <GarmentCard
                  key={garment.id}
                  garment={garment}
                  index={i}
                  canRemove={values.garments.length > 1}
                  onChange={(updated) => updateGarment(i, updated)}
                  onRemove={() => removeGarment(i)}
                  garmentTypes={garmentTypeEntries}
                  garmentBrands={garmentBrandEntries}
                />
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-3 w-full self-start sm:w-auto" onClick={addGarment}>
              <Plus size={14} /> Add Another Garment
            </Button>
          </OrderFormSection>

          <OrderFormSection step={5} title="Artwork / Print Details" description="Your artwork, print position, and size — with a live preview.">
            <PublicPrintDetailsSection
              artworkFiles={values.artworkFiles}
              onArtworkFilesChange={(artworkFiles) => update({ artworkFiles })}
              printSpecs={values.printSpecs}
              onPrintSpecsChange={(printSpecs) => update({ printSpecs })}
              activeSpecId={activeSpecId}
              onActiveSpecIdChange={setActiveSpecId}
              effectiveGarmentType={effectiveGarmentType}
              effectiveColour={effectiveColour}
              artworkError={errors.artwork}
            />
          </OrderFormSection>

          <OrderFormSection step={6} title="Additional Instructions">
            <Textarea
              value={values.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              placeholder="Anything else we should know about this order?"
            />
          </OrderFormSection>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button type="button" variant="primary" onClick={handleReview} className="w-full py-3 text-base">
            Review Order
          </Button>
        </div>
      )}
    </PublicShell>
  )
}

function PublicShell({ businessName, children }: { businessName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-bg px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">{businessName}</h1>
          <p className="text-sm text-zinc-500">Custom Apparel Order Form</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function ReviewSection({
  values,
  totalGarments,
  submitting,
  submitError,
  onEdit,
  onSubmit,
}: {
  values: PublicOrderFormValues
  totalGarments: number
  submitting: boolean
  submitError: string | null
  onEdit: () => void
  onSubmit: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-700">Review &amp; Submit</h2>
      <Card>
        <CardBody className="flex flex-col gap-3 text-sm">
          <ReviewRow label="Customer" value={`${values.customerName}${values.company ? ` (${values.company})` : ''}`} />
          <ReviewRow label="Contact" value={[values.email, values.phone].filter(Boolean).join(' · ') || '—'} />
          <ReviewRow label="Job" value={values.jobTitle || values.customerName} />
          <ReviewRow label="Garments" value={`${values.garments.length} garment line(s), ${totalGarments} total items`} />
          <ReviewRow label="Services" value={values.services.length > 0 ? values.services.join(', ') : 'None selected'} />
          <ReviewRow label="Print Locations" value={values.printSpecs.length > 0 ? `${values.printSpecs.length} location(s)` : 'None'} />
          <ReviewRow label="Required Date" value={values.dueDate || 'Not specified'} />
          <ReviewRow label="Delivery" value={values.deliveryMethod} />
          {values.notes && <ReviewRow label="Notes" value={values.notes} />}
        </CardBody>
      </Card>
      {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onEdit} disabled={submitting}>
          Edit
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          disabled={submitting || submitted}
          onClick={() => {
            setSubmitted(true)
            onSubmit()
          }}
        >
          {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Submit Order'}
        </Button>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-50 pb-2 last:border-0 last:pb-0 sm:flex-row sm:justify-between">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <span className="text-right text-zinc-700 sm:text-left">{value}</span>
    </div>
  )
}
