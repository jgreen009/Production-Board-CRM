import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ImageOff, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { SizeQuantityGrid } from '@/components/domain/SizeQuantityGrid'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'
import type { GarmentType, PrintPosition } from '@/types'
import { ALL_PRINT_POSITIONS, getPositionView, isPrintPositionSupported } from '@/config/garmentGeometry'
import { PRINT_SIZE_PRESETS } from '@/config/printSizePresets'
import { validateArtworkFile } from '@/utils/artworkValidation'
import { validatePublicOrderLink, submitPublicOrder } from '@/api/publicOrder'
import type { PublicLinkInvalidReason } from '@/api/publicOrder'
import type {
  PublicArtworkFileFormValues,
  PublicGarmentFormValues,
  PublicOrderFormValues,
  PublicPrintSpecFormValues,
} from '@/schemas/publicOrderFormSchema'
import { publicOrderFormSchema } from '@/schemas/publicOrderFormSchema'

// Public Customer Order Link — a fully anonymous, chrome-free page (no
// AppShell/sidebar, no RequireAuth — see src/App.tsx). This is
// specification-entry for a customer, not an internal production editor:
// no drag/reposition, no staff-only fields anywhere in this component's
// state, and the mockup preview is the lightweight non-Fabric
// GarmentMockup renderer (Mockup System V2) — Fabric is never loaded here.

let idCounter = 0
function localId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}-${Date.now()}`
}

function emptyGarment(): PublicGarmentFormValues {
  return { id: localId('garment'), type: '', brand: '', colour: '', sizing: 'Adult', adultQuantities: {}, youthQuantities: {} }
}

function emptyPrintSpec(garmentType: string): PublicPrintSpecFormValues {
  return {
    id: crypto.randomUUID(),
    position: 'Left Chest',
    garmentType,
    garmentColour: '',
    widthMm: 210,
    heightMm: 210,
    colour: '',
    artworkFileId: null,
  }
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
  const [garmentTypes, setGarmentTypes] = useState<string[]>([])
  const [garmentBrands, setGarmentBrands] = useState<string[]>([])
  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

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

  const updateGarment = (id: string, patch: Partial<PublicGarmentFormValues>) =>
    update({ garments: values.garments.map((g) => (g.id === id ? { ...g, ...patch } : g)) })

  const addGarment = () => update({ garments: [...values.garments, emptyGarment()] })
  const removeGarment = (id: string) => {
    if (values.garments.length <= 1) return
    update({ garments: values.garments.filter((g) => g.id !== id) })
  }

  const toggleService = (name: string) =>
    update({ services: values.services.includes(name) ? values.services.filter((s) => s !== name) : [...values.services, name] })

  const handleArtworkUpload = (files: FileList | null) => {
    if (!files) return
    const additions: PublicArtworkFileFormValues[] = []
    for (const file of Array.from(files)) {
      const validation = validateArtworkFile(file)
      if (!validation.valid) {
        setErrors((e) => ({ ...e, artwork: validation.reason ?? 'Invalid file' }))
        continue
      }
      additions.push({
        id: localId('artwork'),
        fileName: file.name,
        fileType: validation.fileType!,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        file,
      })
    }
    if (additions.length > 0) {
      setErrors((e) => ({ ...e, artwork: '' }))
      update({ artworkFiles: [...values.artworkFiles, ...additions] })
    }
  }

  const removeArtwork = (id: string) => {
    update({
      artworkFiles: values.artworkFiles.filter((a) => a.id !== id),
      printSpecs: values.printSpecs.map((p) => (p.artworkFileId === id ? { ...p, artworkFileId: null } : p)),
    })
  }

  const primaryGarmentType = values.garments[0]?.type || ''

  const addPrintSpec = () => update({ printSpecs: [...values.printSpecs, emptyPrintSpec(primaryGarmentType)] })
  const updatePrintSpec = (id: string, patch: Partial<PublicPrintSpecFormValues>) =>
    update({ printSpecs: values.printSpecs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const removePrintSpec = (id: string) => update({ printSpecs: values.printSpecs.filter((p) => p.id !== id) })

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
          <Section title="1. Your Details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Your Name" required error={errors.customerName}>
                <Input value={values.customerName} onChange={(e) => update({ customerName: e.target.value })} placeholder="Jane Smith" />
              </FormField>
              <FormField label="Business / Company Name">
                <Input value={values.company} onChange={(e) => update({ company: e.target.value })} placeholder="Optional" />
              </FormField>
              <FormField label="Email" error={errors.email}>
                <Input type="email" value={values.email} onChange={(e) => update({ email: e.target.value })} placeholder="you@example.com" />
              </FormField>
              <FormField label="Phone">
                <Input value={values.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="04xx xxx xxx" />
              </FormField>
            </div>
          </Section>

          <Section title="2. Job Details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Job / Order Title">
                <Input value={values.jobTitle} onChange={(e) => update({ jobTitle: e.target.value })} placeholder="e.g. Team Tees 2026" />
              </FormField>
              <FormField label="Required Date">
                <Input type="date" value={values.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
              </FormField>
            </div>
            <div className="mt-3 flex gap-1.5">
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
          </Section>

          <Section title="3. Garments" error={errors.garments}>
            <div className="flex flex-col gap-3">
              {values.garments.map((garment, i) => (
                <Card key={garment.id}>
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-700">Garment {i + 1}</p>
                      {values.garments.length > 1 && (
                        <button type="button" onClick={() => removeGarment(garment.id)} className="text-zinc-400 hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField label="Garment Type" required>
                        <Select value={garment.type} onChange={(e) => updateGarment(garment.id, { type: e.target.value })}>
                          <option value="">Select…</option>
                          {garmentTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Brand">
                        <Select value={garment.brand} onChange={(e) => updateGarment(garment.id, { brand: e.target.value })}>
                          <option value="">Select…</option>
                          {garmentBrands.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Colour" required>
                        <Input value={garment.colour} onChange={(e) => updateGarment(garment.id, { colour: e.target.value })} placeholder="e.g. Navy" />
                      </FormField>
                    </div>
                    <div className="flex gap-1.5">
                      {(['Adult', 'Youth'] as const).map((sizing) => (
                        <button
                          key={sizing}
                          type="button"
                          onClick={() => updateGarment(garment.id, { sizing })}
                          className={`min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium ${
                            garment.sizing === sizing ? 'border-brand-accent bg-brand-accent-soft text-brand-accent' : 'border-zinc-200 bg-white text-zinc-500'
                          }`}
                        >
                          {sizing} Sizing
                        </button>
                      ))}
                    </div>
                    <SizeQuantityGrid
                      idPrefix={`public-garment-${garment.id}`}
                      sizes={garment.sizing === 'Adult' ? ADULT_SIZES : YOUTH_SIZES}
                      values={garment.sizing === 'Adult' ? garment.adultQuantities : garment.youthQuantities}
                      onChange={(size, qty) =>
                        updateGarment(garment.id, {
                          [garment.sizing === 'Adult' ? 'adultQuantities' : 'youthQuantities']: {
                            ...(garment.sizing === 'Adult' ? garment.adultQuantities : garment.youthQuantities),
                            [size]: qty,
                          },
                        })
                      }
                    />
                  </CardBody>
                </Card>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addGarment} className="self-start">
                <Plus size={14} /> Add Garment
              </Button>
            </div>
          </Section>

          {availableServices.length > 0 && (
            <Section title="4. Services Required">
              <div className="flex flex-wrap gap-1.5">
                {availableServices.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={`min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium ${
                      values.services.includes(service) ? 'border-brand-accent bg-brand-accent-soft text-brand-accent' : 'border-zinc-200 bg-white text-zinc-500'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="5. Artwork & Print" error={errors.artwork}>
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-zinc-300 p-6 text-center hover:border-brand-accent">
                <Upload size={20} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600">Upload artwork</span>
                <span className="text-xs text-zinc-400">PNG, JPG, WEBP, SVG, PDF, AI — up to 25MB each</span>
                <input type="file" multiple className="hidden" onChange={(e) => handleArtworkUpload(e.target.files)} />
              </label>

              {values.artworkFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {values.artworkFiles.map((a) => (
                    <div key={a.id} className="relative rounded-md border border-zinc-200 p-2">
                      <button
                        type="button"
                        onClick={() => removeArtwork(a.id)}
                        className="absolute right-1 top-1 rounded-full bg-white p-1 text-zinc-400 shadow hover:text-danger"
                        aria-label={`Remove ${a.fileName}`}
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="mb-1 flex h-16 items-center justify-center overflow-hidden rounded bg-zinc-50">
                        {a.previewUrl ? (
                          <img src={a.previewUrl} alt={a.fileName} className="h-full w-full object-contain" />
                        ) : (
                          <ImageOff size={16} className="text-zinc-300" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-zinc-500">{a.fileName}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {values.printSpecs.map((spec) => {
                  const supported = spec.garmentType ? isPrintPositionSupported(spec.garmentType as GarmentType, spec.position as PrintPosition) : false
                  const artwork = values.artworkFiles.find((a) => a.id === spec.artworkFileId)
                  return (
                    <Card key={spec.id}>
                      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <FormField label="Garment">
                              <Select value={spec.garmentType} onChange={(e) => updatePrintSpec(spec.id, { garmentType: e.target.value })}>
                                <option value="">Select…</option>
                                {values.garments.filter((g) => g.type).map((g) => (
                                  <option key={g.id} value={g.type}>{g.type} ({g.colour || 'colour tbc'})</option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField label="Print Position">
                              <Select value={spec.position} onChange={(e) => updatePrintSpec(spec.id, { position: e.target.value })}>
                                {ALL_PRINT_POSITIONS.map((p) => (
                                  <option key={p.position} value={p.position}>{p.label}</option>
                                ))}
                              </Select>
                            </FormField>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PRINT_SIZE_PRESETS.map((preset) => (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => updatePrintSpec(spec.id, { widthMm: preset.widthMm, heightMm: preset.widthMm })}
                                className={`min-h-8 rounded-md border px-2.5 py-1 text-xs font-medium ${
                                  spec.widthMm === preset.widthMm ? 'border-brand-accent bg-brand-accent-soft text-brand-accent' : 'border-zinc-200 bg-white text-zinc-500'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <FormField label="Artwork for this print">
                            <Select value={spec.artworkFileId ?? ''} onChange={(e) => updatePrintSpec(spec.id, { artworkFileId: e.target.value || null })}>
                              <option value="">No artwork selected</option>
                              {values.artworkFiles.map((a) => (
                                <option key={a.id} value={a.id}>{a.fileName}</option>
                              ))}
                            </Select>
                          </FormField>
                          {!supported && spec.garmentType && (
                            <p className="text-xs text-warning">{spec.garmentType} doesn&rsquo;t support this print position yet — choose another.</p>
                          )}
                          <button type="button" onClick={() => removePrintSpec(spec.id)} className="self-start text-xs text-zinc-400 hover:text-danger">
                            Remove this print location
                          </button>
                        </div>
                        {spec.garmentType && supported && (
                          <div className="shrink-0">
                            <GarmentMockup
                              garmentType={spec.garmentType as GarmentType}
                              colour={values.garments.find((g) => g.type === spec.garmentType)?.colour ?? ''}
                              view={getPositionView(spec.position as PrintPosition)}
                              position={spec.position as PrintPosition}
                              artworkUrl={artwork?.previewUrl}
                              widthMm={spec.widthMm}
                              heightMm={spec.heightMm}
                              size={140}
                            />
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  )
                })}
                <Button type="button" variant="secondary" size="sm" onClick={addPrintSpec} className="self-start" disabled={!primaryGarmentType}>
                  <Plus size={14} /> Add Print Location
                </Button>
              </div>
            </div>
          </Section>

          <Section title="6. Additional Instructions">
            <Textarea
              value={values.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              placeholder="Anything else we should know about this order?"
            />
          </Section>

          {submitError && <p className="text-sm font-medium text-danger">{submitError}</p>}

          <Button type="button" variant="primary" onClick={handleReview} className="w-full py-3 text-base">
            Review Order
          </Button>
        </div>
      )}
    </PublicShell>
  )
}

function Section({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      {children}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
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
