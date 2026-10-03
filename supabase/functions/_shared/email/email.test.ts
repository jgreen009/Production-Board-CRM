import { describe, expect, it } from 'vitest'
import { ALL_PRINT_POSITIONS, getPrintPositionLabel } from '../../../../src/config/garmentGeometry'
import type { PrintPosition } from '../../../../src/types'
import {
  decideSend,
  idempotencyKeyFor,
  isEmailTypeAllowedForOrder,
  isPlausibleEmail,
  categorizeResendStatus,
  subjectFor,
} from './policy.ts'
import {
  buildCustomerOrderSummary,
  formatRequiredDate,
  POSITION_LABELS,
  type RawOrderForEmail,
} from './summary.ts'
import { escapeHtml, renderOrderEmailHtml, renderOrderEmailText } from './render.ts'
import { sendViaResend } from './resend.ts'

// Fixture that contains deliberately internal values. Every test below checks
// these never reach a customer-facing email.
function rawOrder(overrides: Partial<RawOrderForEmail> = {}): RawOrderForEmail {
  return {
    order_number: 'SP-1500',
    job_name: 'Kelston Rugby Tour',
    email: 'dave@example.com',
    phone: '0400 000 000',
    due_date: '2026-10-24',
    delivery_method: 'Delivery',
    notes: 'Please use the darker navy.',
    customers: { name: 'Dave Kelston', company: 'Kelston Rugby', email: null, phone: null },
    order_garments: [
      {
        garment_type_label: 'T-shirt',
        garment_brand_label: 'AS Colour',
        colour: 'Black',
        sort_order: 0,
        garment_quantities: [
          { size: 'L', quantity: 5 },
          { size: 'S', quantity: 5 },
          { size: 'M', quantity: 10 },
          { size: 'XL', quantity: 0 },
        ],
      },
      {
        garment_type_label: 'Hoody',
        garment_brand_label: 'Customized',
        colour: 'Navy',
        sort_order: 1,
        garment_quantities: [{ size: 'M', quantity: 3 }],
      },
    ],
    order_services: [{ services: { name: 'Screen Print' } }, { services: null }],
    print_specs: [
      {
        id: 'spec-1',
        position: 'Left Chest',
        colour: 'White',
        width_mm: 90,
        garment_type: 'T-shirt',
        garment_colour: 'Black',
        sort_order: 0,
        preview_storage_path: 'orders/o1/print-specs/spec-1/preview.png',
        artwork: { file_name: 'logo.png' },
      },
      {
        id: 'spec-2',
        position: 'Full Back',
        colour: '',
        width_mm: 280,
        garment_type: 'T-shirt',
        garment_colour: 'Black',
        sort_order: 1,
        preview_storage_path: null,
        artwork: null,
      },
    ],
    ...overrides,
  } as RawOrderForEmail
}

const INTERNAL_MARKERS = [
  'Assigned',
  'Queue Priority',
  'Production Status',
  'Internal Notes',
  'Production Notes',
  'Approval Note',
  'Urgent',
  'In Production',
  'Need Ordering',
  'staff-only-internal-note',
]

function internalFixture(): RawOrderForEmail {
  const raw = rawOrder({ notes: 'Customer note here' })
  return Object.assign(raw, {
    production_notes: 'staff-only-internal-note',
    priority: 'Urgent',
    production_status: 'In Production',
    garment_status: 'Need Ordering',
    artwork_status: 'Need Vectored',
    assigned_to: 'Staff Member Name',
    approval_note: 'Approval Note text',
    staff_completed: true,
  })
}

describe('customer-safe summary', () => {
  const summary = buildCustomerOrderSummary(rawOrder(), {})

  it('includes order number', () => expect(summary.orderNumber).toBe('SP-1500'))
  it('includes customer name and company', () => {
    expect(summary.customerName).toBe('Dave Kelston')
    expect(summary.companyName).toBe('Kelston Rugby')
  })
  it('includes garments with colour and brand where meaningful', () => {
    expect(summary.garments[0]).toMatchObject({ heading: 'T-shirt', colour: 'Black', brand: 'AS Colour' })
    expect(summary.garments[1].brand).toBeNull()
  })
  it('includes quantities, sorted by size and dropping zero quantities', () => {
    expect(summary.garments[0].sizes).toEqual([
      { size: 'S', quantity: 5 },
      { size: 'M', quantity: 10 },
      { size: 'L', quantity: 5 },
    ])
    expect(summary.garments[0].totalQuantity).toBe(20)
  })
  it('includes services and skips unresolved ones', () => {
    expect(summary.services).toEqual(['Screen Print'])
  })
  it('includes print specs with the form-facing position label', () => {
    expect(summary.printSpecs[0]).toMatchObject({ position: 'Right Chest', artworkFileName: 'logo.png', widthMm: 90 })
  })
  it('includes the required date formatted without timezone drift', () => {
    expect(summary.requiredDate).toBe('24 Oct 2026')
  })
  it('includes delivery method', () => expect(summary.deliveryMethod).toBe('Delivery'))
  it('includes customer notes', () => expect(summary.customerNotes).toBe('Please use the darker navy.'))

  it('excludes assigned staff, statuses, priority, and internal notes', () => {
    const built = buildCustomerOrderSummary(internalFixture(), {})
    const serialised = JSON.stringify(built)
    for (const marker of INTERNAL_MARKERS) expect(serialised).not.toContain(marker)
    expect(Object.keys(built)).not.toEqual(expect.arrayContaining(['assigned_to', 'priority', 'productionNotes']))
  })
  it('excludes approval notes even when present on the source row', () => {
    const built = buildCustomerOrderSummary(internalFixture(), {})
    expect(JSON.stringify(built)).not.toContain('Approval Note text')
  })
  it('exposes no storage paths in the summary itself', () => {
    expect(JSON.stringify(summary)).not.toContain('orders/o1/print-specs')
  })
})

describe('templates', () => {
  const summary = buildCustomerOrderSummary(rawOrder(), {
    'spec-1': 'https://example.supabase.co/storage/v1/object/sign/mockup-previews/x.png?token=abc',
  })

  it('staff subject is correct', () => {
    expect(subjectFor('staff_order_summary', 'SP-1500')).toBe('Brand Fanatix Order SP-1500 — Please Review')
  })
  it('public receipt subject is correct', () => {
    expect(subjectFor('customer_order_receipt', 'SP-1500')).toBe('We received your Brand Fanatix order request — SP-1500')
  })
  it('staff email uses review wording', () => {
    const html = renderOrderEmailHtml(summary, 'staff_order_summary')
    expect(html).toContain("We&#39;ve prepared the order details below for your review.")
  })
  it('customer receipt uses receipt wording', () => {
    const html = renderOrderEmailHtml(summary, 'customer_order_receipt')
    expect(html).toContain('Thanks for submitting your order request.')
  })
  it('public receipt never asks the customer to approve or confirm', () => {
    const html = renderOrderEmailHtml(summary, 'customer_order_receipt')
    const text = renderOrderEmailText(summary, 'customer_order_receipt')
    for (const body of [html, text]) {
      expect(body.toLowerCase()).not.toContain('satisfied')
      expect(body.toLowerCase()).not.toContain('approve')
      expect(body.toLowerCase()).not.toContain('confirm')
    }
  })
  it('escapes customer-provided content in HTML', () => {
    const evil = buildCustomerOrderSummary(
      rawOrder({
        job_name: '<script>alert(1)</script>',
        notes: '"><img src=x onerror=alert(1)>',
        customers: { name: '<b>Eve</b>', company: null, email: null, phone: null },
      }),
      {},
    )
    const html = renderOrderEmailHtml(evil, 'staff_order_summary')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>Eve</b>')
    expect(html).toContain('&lt;script&gt;')
  })
  it('renders empty optional fields without bare labels', () => {
    const bare = buildCustomerOrderSummary(
      rawOrder({
        notes: null,
        phone: null,
        due_date: null,
        order_services: [],
        print_specs: [],
        customers: null,
        email: 'a@b.co',
      }),
      {},
    )
    const html = renderOrderEmailHtml(bare, 'staff_order_summary')
    expect(html).not.toContain('Your notes')
    expect(html).not.toContain('Required date')
    expect(html).not.toContain('>Phone</td>')
    expect(html).toContain('Hello,')
  })
  it('renders mockup images only where a preview URL exists', () => {
    const html = renderOrderEmailHtml(summary, 'staff_order_summary')
    expect(html.match(/<img /g)?.length).toBe(1)
    expect(html).toContain('alt="Right Chest mockup"')
  })
  it('text version carries the same garments and quantities', () => {
    const text = renderOrderEmailText(summary, 'staff_order_summary')
    expect(text).toContain('S × 5')
    expect(text).toContain('Hoody — Navy')
  })
  it('escapeHtml covers the special characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('position label sync with the form', () => {
  it('summary mirror matches the form-facing label for every print position', () => {
    for (const { position } of ALL_PRINT_POSITIONS) {
      expect(POSITION_LABELS[position], `missing ${position}`).toBe(getPrintPositionLabel(position as PrintPosition))
    }
  })
})

describe('formatRequiredDate', () => {
  it('formats a plain calendar date', () => expect(formatRequiredDate('2026-01-05')).toBe('5 Jan 2026'))
  it('returns null for missing or malformed dates', () => {
    expect(formatRequiredDate(null)).toBeNull()
    expect(formatRequiredDate('not-a-date')).toBeNull()
  })
})

describe('authorization policy', () => {
  it('staff may send the staff summary for any order', () => {
    expect(isEmailTypeAllowedForOrder('staff_order_summary', 'staff')).toBe(true)
    expect(isEmailTypeAllowedForOrder('staff_order_summary', 'public_form')).toBe(true)
  })
  it('a customer receipt may only be sent for a public-form order', () => {
    expect(isEmailTypeAllowedForOrder('customer_order_receipt', 'public_form')).toBe(true)
    expect(isEmailTypeAllowedForOrder('customer_order_receipt', 'staff')).toBe(false)
  })
})

describe('send decisions (idempotency and retry)', () => {
  it('first automatic send proceeds as attempt 1', () => {
    expect(decideSend([], false)).toEqual({ action: 'send', attempt: 1 })
  })
  it('an automatic trigger never re-sends when a sent email already exists', () => {
    expect(decideSend([{ status: 'sent' }], false)).toEqual({ action: 'skip', reason: 'already_sent' })
  })
  it('an automatic trigger does not fire again after a failed attempt', () => {
    expect(decideSend([{ status: 'failed' }], false)).toEqual({ action: 'skip', reason: 'already_attempted' })
  })
  it('an explicit retry is allowed after a failure, with a new attempt number', () => {
    expect(decideSend([{ status: 'failed' }], true)).toEqual({ action: 'send', attempt: 2 })
  })
  it('an explicit retry is allowed after a bounce', () => {
    expect(decideSend([{ status: 'bounced' }], true)).toEqual({ action: 'send', attempt: 2 })
  })
  it('an explicit retry never re-sends an already-sent email', () => {
    expect(decideSend([{ status: 'failed' }, { status: 'sent' }], true)).toEqual({ action: 'skip', reason: 'already_sent' })
  })
  it('a concurrent in-flight send blocks a second one', () => {
    expect(decideSend([{ status: 'queued' }], true)).toEqual({ action: 'skip', reason: 'in_progress' })
  })
  it('idempotency keys differ per attempt so a retry is never answered from a cached failure', () => {
    const first = idempotencyKeyFor('o1', 'staff_order_summary', 1)
    const retry = idempotencyKeyFor('o1', 'staff_order_summary', 2)
    expect(first).toBe('order:o1:staff_order_summary:attempt1')
    expect(retry).not.toBe(first)
  })
})

describe('recipient and failure categories', () => {
  it('accepts a plausible address and rejects an empty or malformed one', () => {
    expect(isPlausibleEmail('dave@example.com')).toBe(true)
    expect(isPlausibleEmail('')).toBe(false)
    expect(isPlausibleEmail(null)).toBe(false)
    expect(isPlausibleEmail('not an email')).toBe(false)
  })
  it('categorizes provider HTTP statuses without exposing them', () => {
    expect(categorizeResendStatus(403)).toBe('resend_sender_rejected')
    expect(categorizeResendStatus(429)).toBe('resend_rate_limited')
    expect(categorizeResendStatus(503)).toBe('resend_unavailable')
    expect(categorizeResendStatus(422)).toBe('resend_rejected_request')
  })
})

describe('sendViaResend', () => {
  const input = {
    apiKey: 're_test_key',
    from: 'Brand Fanatix <orders@globalteez.com>',
    to: 'dave@example.com',
    subject: 's',
    html: '<p>x</p>',
    text: 'x',
    idempotencyKey: 'order:o1:staff_order_summary:attempt1',
  }

  it('returns the provider id and sends the idempotency key', async () => {
    let seenHeaders: Record<string, string> = {}
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      seenHeaders = init.headers as Record<string, string>
      return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 })
    }) as typeof fetch
    const result = await sendViaResend(input, fakeFetch)
    expect(result).toEqual({ ok: true, id: 'email_123' })
    expect(seenHeaders['Idempotency-Key']).toBe(input.idempotencyKey)
  })

  it('returns a categorized failure and never the raw provider body', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ message: 'secret provider detail re_live_xyz' }), { status: 403 })) as typeof fetch
    const result = await sendViaResend(input, fakeFetch)
    expect(result).toEqual({ ok: false, category: 'resend_sender_rejected' })
    expect(JSON.stringify(result)).not.toContain('re_live_xyz')
  })

  it('treats a network throw as a categorized network failure', async () => {
    const fakeFetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    expect(await sendViaResend(input, fakeFetch)).toEqual({ ok: false, category: 'network_error' })
  })
})
