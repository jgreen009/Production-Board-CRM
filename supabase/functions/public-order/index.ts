// Public Customer Order Link — the one trusted, server-side path a fully
// anonymous customer submission goes through. This is the FIRST anon-facing
// surface in this project (see docs/PUBLIC_ORDER_LINK_HANDOVER.md) — every
// privileged write (order creation, artwork upload, link consumption) is
// deliberately concentrated here, using the service-role key, so the
// public browser never gets direct table/Storage access. Nothing in the
// request body is ever trusted for authorization or for internal-workflow
// fields (priority, statuses, assignment) — those are always hardcoded
// server-side to the same safe defaults a normal new order gets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
}

function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'public-order', step, ...detail }))
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------
// Artwork validation — mirrors src/utils/artworkValidation.ts exactly
// (allowed extensions, 25MB limit, MIME cross-check where reliable). The
// browser-side copy exists for fast UX feedback only; THIS copy is the
// one that actually matters, since a public endpoint can be hit directly
// with any bytes regardless of what the public form's own JS validated.
// ---------------------------------------------------------------------
const MAX_ARTWORK_FILE_SIZE_BYTES = 25 * 1024 * 1024
const ARTWORK_EXTENSION_MAP: Record<string, string> = {
  png: 'PNG', jpg: 'JPG', jpeg: 'JPG', webp: 'WEBP', svg: 'SVG', pdf: 'PDF', ai: 'AI',
}
const EXPECTED_MIME: Record<string, string[]> = {
  PNG: ['image/png'], JPG: ['image/jpeg'], WEBP: ['image/webp'], SVG: ['image/svg+xml'], PDF: ['application/pdf'],
}

function validateArtworkFile(file: File): { valid: boolean; reason?: string; fileType?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fileType = ARTWORK_EXTENSION_MAP[ext]
  if (!fileType) return { valid: false, reason: `Unsupported file type ".${ext}"` }
  if (file.size > MAX_ARTWORK_FILE_SIZE_BYTES) return { valid: false, reason: 'File exceeds the 25MB limit' }
  const expectedMime = EXPECTED_MIME[fileType]
  if (expectedMime && file.type && !expectedMime.includes(file.type)) {
    return { valid: false, reason: `File extension ".${ext}" doesn't match its actual content type` }
  }
  return { valid: true, fileType }
}

// ---------------------------------------------------------------------
// Print position support — mirrors getSupportedPrintPositions() in
// src/config/garmentGeometry.ts (Mockup System V2's non-upper-body
// extension). Kept as a small, explicit constant here rather than porting
// that whole module into Deno; if garmentGeometry.ts's per-garment
// vocabulary ever changes, this must be updated to match, or a garment
// could show as supported here but render with no zone client-side. A
// malicious public request combining a garment with a position it doesn't
// support (e.g. Shorts + Left Chest, Beanie + Full Back) is always
// rejected server-side, regardless of what the public form's own JS
// already filtered out client-side.
// ---------------------------------------------------------------------
const UPPER_BODY_POSITIONS = [
  'Left Chest', 'Right Chest', 'Across Chest', 'Full Front', 'Left Sleeve', 'Right Sleeve',
  'Full Back', 'Top Back', 'Bottom Back',
]
const GARMENT_SUPPORTED_POSITIONS: Record<string, string[]> = {
  'T-shirt': UPPER_BODY_POSITIONS,
  Polo: UPPER_BODY_POSITIONS,
  Shirt: UPPER_BODY_POSITIONS,
  'Hi-Viz vest': UPPER_BODY_POSITIONS,
  Singlet: UPPER_BODY_POSITIONS,
  'Crew neck (jumper)': UPPER_BODY_POSITIONS,
  Hoody: UPPER_BODY_POSITIONS,
  Customized: UPPER_BODY_POSITIONS,
  Bennie: ['Front', 'Back'],
  Hats: ['Front', 'Back'],
  Shorts: ['Left Leg', 'Right Leg', 'Back'],
  Pants: ['Left Thigh', 'Right Thigh', 'Left Leg', 'Right Leg', 'Back'],
}

function isPrintPositionSupported(garmentType: string, position: string): boolean {
  return (GARMENT_SUPPORTED_POSITIONS[garmentType] ?? []).includes(position)
}

// ---------------------------------------------------------------------
// Payload sanitization — a strict allow-list. Anything not explicitly
// read here is discarded, regardless of what a malicious client includes
// (staff-only fields like paymentStatus/priority/assignedTo/internal
// notes have no path into the RPC payload at all — there is no
// "ignore if present" branch, because the fields are simply never read).
// ---------------------------------------------------------------------
interface SanitizedSubmission {
  customer: { name: string; company: string; email: string; phone: string }
  order: { jobName: string; phone: string; email: string; dueDate: string; deliveryMethod: string; notes: string }
  garments: {
    type: string
    brand: string
    colour: string
    sizing: string
    adultQuantities: Record<string, number>
    youthQuantities: Record<string, number>
    sortOrder: number
  }[]
  services: string[]
  printSpecs: {
    id: string
    position: string
    colour: string
    widthMm: number
    heightMm: number
    garmentType: string
    garmentColour: string
    artworkKey: string | null
    sortOrder: number
  }[]
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function sanitizeString(value: unknown, maxLength = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function sanitizeSubmission(raw: unknown): { ok: true; value: SanitizedSubmission } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Invalid submission payload' }
  const body = raw as Record<string, unknown>

  const customerRaw = (body.customer ?? {}) as Record<string, unknown>
  const customerName = sanitizeString(customerRaw.name, 200)
  if (!customerName) return { ok: false, error: 'Your name is required' }

  const orderRaw = (body.order ?? {}) as Record<string, unknown>
  const jobName = sanitizeString(orderRaw.jobName, 200) || customerName
  const deliveryMethod = orderRaw.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pick Up'

  const garmentsRaw = Array.isArray(body.garments) ? body.garments : []
  if (garmentsRaw.length === 0) return { ok: false, error: 'At least one garment is required' }

  const garments = garmentsRaw.map((g, i) => {
    const garment = (g ?? {}) as Record<string, unknown>
    const adultQuantities: Record<string, number> = {}
    const youthQuantities: Record<string, number> = {}
    const adultRaw = (garment.adultQuantities ?? {}) as Record<string, unknown>
    const youthRaw = (garment.youthQuantities ?? {}) as Record<string, unknown>
    for (const [size, qty] of Object.entries(adultRaw)) {
      const n = Number(qty)
      if (Number.isInteger(n) && n > 0) adultQuantities[sanitizeString(size, 10)] = n
    }
    for (const [size, qty] of Object.entries(youthRaw)) {
      const n = Number(qty)
      if (Number.isInteger(n) && n > 0) youthQuantities[sanitizeString(size, 10)] = n
    }
    return {
      type: sanitizeString(garment.type, 100),
      brand: sanitizeString(garment.brand, 100) || 'Customized',
      colour: sanitizeString(garment.colour, 100),
      sizing: garment.sizing === 'Youth' ? 'Youth' : 'Adult',
      adultQuantities,
      youthQuantities,
      sortOrder: i,
    }
  })

  const servicesRaw = Array.isArray(body.services) ? body.services : []
  const services = servicesRaw.map((s) => sanitizeString(s, 100)).filter(Boolean)

  const printSpecsRaw = Array.isArray(body.printSpecs) ? body.printSpecs : []
  const printSpecs = printSpecsRaw.map((p, i) => {
    const spec = (p ?? {}) as Record<string, unknown>
    const garmentType = sanitizeString(spec.garmentType, 100)
    const position = sanitizeString(spec.position, 50)
    const widthMm = Number(spec.widthMm)
    return {
      id: isUuid(spec.id) ? spec.id : crypto.randomUUID(),
      position,
      colour: sanitizeString(spec.colour, 100),
      widthMm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 100,
      heightMm: Number.isFinite(Number(spec.heightMm)) && Number(spec.heightMm) > 0 ? Number(spec.heightMm) : 100,
      garmentType,
      garmentColour: sanitizeString(spec.garmentColour, 100),
      artworkKey: typeof spec.artworkKey === 'string' ? spec.artworkKey : null,
      sortOrder: i,
      _supported: isPrintPositionSupported(garmentType, position),
    }
  })

  const unsupportedSpec = printSpecs.find((p) => !p._supported)
  if (unsupportedSpec) {
    return { ok: false, error: `${unsupportedSpec.garmentType} does not support the ${unsupportedSpec.position} print position` }
  }

  return {
    ok: true,
    value: {
      customer: {
        name: customerName,
        company: sanitizeString(customerRaw.company, 200),
        email: sanitizeString(customerRaw.email, 200).toLowerCase(),
        phone: sanitizeString(customerRaw.phone, 50),
      },
      order: {
        jobName,
        phone: sanitizeString(orderRaw.phone, 50) || sanitizeString(customerRaw.phone, 50),
        email: sanitizeString(orderRaw.email, 200).toLowerCase() || sanitizeString(customerRaw.email, 200).toLowerCase(),
        dueDate: sanitizeString(orderRaw.dueDate, 20),
        deliveryMethod,
        notes: sanitizeString(orderRaw.notes, 2000),
      },
      garments,
      services,
      printSpecs: printSpecs.map(({ _supported: _unused, ...rest }) => rest),
    },
  }
}

// ---------------------------------------------------------------------
// validate action — read-only pre-check (fast, friendly error before the
// customer fills out the whole form) plus the reference catalogs the
// public page needs, fetched with the service-role key since `anon` has
// no read policy on garment_types/garment_brands/services (deliberately
// left that way — see the handover doc). This does NOT consume the link;
// only create_public_order_submission's atomic UPDATE does that.
// ---------------------------------------------------------------------
async function handleValidate(admin: ReturnType<typeof adminClient>, token: string) {
  if (!token) return json({ valid: false, reason: 'not_found' }, 200)
  const tokenHash = await sha256Hex(token)

  const { data: link } = await admin
    .from('public_order_links')
    .select('is_active, expires_at, max_submissions, submission_count')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!link) return json({ valid: false, reason: 'not_found' }, 200)
  if (!link.is_active) return json({ valid: false, reason: 'revoked' }, 200)
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return json({ valid: false, reason: 'expired' }, 200)
  if (link.submission_count >= link.max_submissions) return json({ valid: false, reason: 'used' }, 200)

  // garment_types/garment_brands/services all have zero anon read access
  // by design (see the handover doc) — fetched here with the service-role
  // key instead of ever opening a new anon RLS policy on tables staff also
  // write to. supplier_url is included so the public form's reused
  // GarmentCard component can show the same "View Supplier Garment" link
  // staff see — read-only reference data, not the supplier MANAGEMENT UI.
  const [{ data: garmentTypes }, { data: garmentBrands }, { data: services }, { data: business }] = await Promise.all([
    admin.from('garment_types').select('name, supplier_url').eq('active', true).order('sort_order'),
    admin.from('garment_brands').select('name').eq('active', true).order('sort_order'),
    admin.from('services').select('id, name').eq('active', true).order('sort_order'),
    admin.from('business_settings').select('business_name').limit(1).maybeSingle(),
  ])

  return json(
    {
      valid: true,
      garmentTypes: (garmentTypes ?? []).map((g) => ({ name: g.name, supplierUrl: g.supplier_url ?? undefined })),
      garmentBrands: (garmentBrands ?? []).map((b) => b.name),
      services: (services ?? []).map((s) => ({ id: s.id, name: s.name })),
      businessName: business?.business_name ?? 'Brand Fanatix',
    },
    200,
  )
}

// ---------------------------------------------------------------------
// submit action — multipart/form-data: a `token` field, a `payload` JSON
// field, and zero or more File fields named `artwork_<key>` where <key>
// matches a printSpec's artworkKey. Uploads land at the SAME path scheme
// normal staff-uploaded artwork uses (orders/{orderId}/artwork/{artworkId}/{fileName})
// — a public order's artwork is indistinguishable in Storage from a staff
// one. The order id and every artwork id are generated here (not by the
// DB) specifically so Storage upload (order id needed for the path) can
// happen BEFORE the single atomic RPC call that creates every DB row.
// ---------------------------------------------------------------------
async function handleSubmit(admin: ReturnType<typeof adminClient>, formData: FormData) {
  const token = String(formData.get('token') ?? '')
  const payloadRaw = String(formData.get('payload') ?? '')
  if (!token || !payloadRaw) return json({ error: 'Malformed submission' }, 400)

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(payloadRaw)
  } catch {
    return json({ error: 'Malformed submission' }, 400)
  }

  const sanitized = sanitizeSubmission(parsedPayload)
  if (!sanitized.ok) {
    logStep('submit_rejected_invalid_payload', { reason: sanitized.error })
    return json({ error: sanitized.error }, 400)
  }

  const tokenHash = await sha256Hex(token)

  // Fast pre-check for a friendly error — the RPC's own atomic UPDATE is
  // the real, race-safe enforcement; this just avoids uploading files for
  // an obviously-dead link before finding out it's dead.
  const { data: precheck } = await admin
    .from('public_order_links')
    .select('is_active, expires_at, max_submissions, submission_count')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!precheck) return json({ error: 'This order link is invalid.' }, 404)
  if (!precheck.is_active) return json({ error: 'This order link has been revoked.' }, 410)
  if (precheck.expires_at && new Date(precheck.expires_at).getTime() < Date.now()) {
    return json({ error: 'This order link has expired.' }, 410)
  }
  if (precheck.submission_count >= precheck.max_submissions) {
    return json({ error: 'This order link has already been used.' }, 410)
  }

  const orderId = crypto.randomUUID()
  const BUCKET = 'artwork-originals'
  const artwork: { id: string; fileName: string; fileType: string; mimeType: string; sizeBytes: number; storagePath: string }[] = []
  const keyToArtworkId = new Map<string, string>()

  for (const [fieldName, value] of formData.entries()) {
    if (!fieldName.startsWith('artwork_') || !(value instanceof File)) continue
    const key = fieldName.slice('artwork_'.length)
    const validation = validateArtworkFile(value)
    if (!validation.valid) {
      logStep('submit_rejected_artwork', { reason: validation.reason })
      return json({ error: validation.reason ?? 'Invalid artwork file' }, 400)
    }

    const artworkId = crypto.randomUUID()
    const storagePath = `orders/${orderId}/artwork/${artworkId}/${value.name}`
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, value, {
      contentType: value.type || undefined,
      upsert: false,
    })
    if (uploadError) {
      logStep('submit_artwork_upload_failed', { errorCategory: uploadError.name })
      return json({ error: 'Artwork upload failed. Please try again.' }, 500)
    }

    keyToArtworkId.set(key, artworkId)
    artwork.push({
      id: artworkId,
      fileName: value.name,
      fileType: validation.fileType!,
      mimeType: value.type || '',
      sizeBytes: value.size,
      storagePath,
    })
  }

  const printSpecs = sanitized.value.printSpecs.map((spec) => ({
    ...spec,
    artworkId: spec.artworkKey ? (keyToArtworkId.get(spec.artworkKey) ?? null) : null,
  }))

  const { data: result, error: rpcError } = await admin.rpc('create_public_order_submission', {
    p_token_hash: tokenHash,
    p_order_id: orderId,
    p_payload: {
      customer: sanitized.value.customer,
      order: sanitized.value.order,
      garments: sanitized.value.garments,
      services: sanitized.value.services,
      artwork,
      printSpecs,
    },
  })

  if (rpcError) {
    logStep('submit_rpc_failed', { errorCategory: rpcError.code ?? 'unknown', message: rpcError.message })
    // Best-effort cleanup of the files just uploaded — the order was never
    // created, so nothing should reference these paths.
    if (artwork.length > 0) {
      await admin.storage.from(BUCKET).remove(artwork.map((a) => a.storagePath))
    }
    const message = rpcError.message?.includes('invalid, expired')
      ? 'This order link is invalid, expired, or has already been used.'
      : 'We could not submit your order. Please try again.'
    return json({ error: message }, rpcError.message?.includes('invalid, expired') ? 410 : 500)
  }

  logStep('submit_succeeded', { orderId, orderNumber: (result as { orderNumber?: string })?.orderNumber })
  return json(result, 200)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const admin = adminClient()
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      return await handleSubmit(admin, formData)
    }

    const body = (await req.json()) as { action?: string; token?: string }
    if (body.action === 'validate') {
      return await handleValidate(admin, String(body.token ?? ''))
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    logStep('unhandled_exception', { errorCategory: err instanceof Error ? err.name : typeof err })
    console.error(err)
    return json({ error: 'The order form service is temporarily unavailable. Please try again.' }, 500)
  }
})
