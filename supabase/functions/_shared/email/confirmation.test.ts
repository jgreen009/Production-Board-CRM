import { describe, expect, it } from 'vitest'
import {
  buildConfirmationUrl,
  canonicalJson,
  confirmDecision,
  confirmationStateFromRows,
  customerFingerprint,
  generateRawToken,
  hashToken,
  reviewState,
  shouldSupersede,
  type ConfirmationRow,
} from './confirmation.ts'
import { buildCustomerOrderSummary, type CustomerOrderSummary, type RawOrderForEmail } from './summary.ts'
import { renderOrderEmailHtml, renderOrderEmailText } from './render.ts'

const NOW = Date.parse('2026-10-03T12:00:00Z')

function row(overrides: Partial<ConfirmationRow> = {}): ConfirmationRow {
  return {
    id: 'c1',
    order_id: 'o1',
    status: 'pending',
    summary_hash: 'hash-a',
    confirmed_at: null,
    expires_at: null,
    ...overrides,
  }
}

function raw(overrides: Partial<RawOrderForEmail> = {}): RawOrderForEmail {
  return {
    order_number: 'SP-1500',
    job_name: 'Kelston Rugby Tour',
    email: 'dave@example.com',
    phone: '0400 000 000',
    due_date: '2026-10-24',
    delivery_method: 'Delivery',
    notes: 'Darker navy please.',
    customers: { name: 'Dave Kelston', company: 'Kelston Rugby', email: null, phone: null },
    order_garments: [
      {
        garment_type_label: 'T-shirt',
        garment_brand_label: 'AS Colour',
        colour: 'Black',
        sort_order: 0,
        garment_quantities: [
          { size: 'S', quantity: 5 },
          { size: 'M', quantity: 10 },
        ],
      },
    ],
    order_services: [{ services: { name: 'Screen Print' } }],
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
    ],
    ...overrides,
  } as RawOrderForEmail
}

function summaryOf(overrides: Partial<RawOrderForEmail> = {}, previews: Record<string, string | null> = {}): CustomerOrderSummary {
  return buildCustomerOrderSummary(raw(overrides), previews)
}

describe('token generation and storage', () => {
  it('generates a URL-safe token of at least 256 bits of encoded entropy', () => {
    const token = generateRawToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThanOrEqual(43)
  })

  it('generates a different token every time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRawToken()))
    expect(tokens.size).toBe(50)
  })

  it('stores only a hash, and the hash lookup is deterministic', async () => {
    const token = generateRawToken()
    const stored = await hashToken(token)
    expect(stored).not.toContain(token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashToken(token)).toBe(stored)
  })

  it('an invalid or unrelated token hashes to something that matches no stored row', async () => {
    const stored = await hashToken(generateRawToken())
    expect(await hashToken('not-the-token-at-all-but-long-enough-1234')).not.toBe(stored)
  })
})

describe('confirmation URL', () => {
  it('builds the link from APP_PUBLIC_URL and carries only the raw token', () => {
    expect(buildConfirmationUrl('https://globalteez.com', 'tok_abc')).toBe('https://globalteez.com/order-confirmation/tok_abc')
  })
  it('tolerates a trailing slash in APP_PUBLIC_URL', () => {
    expect(buildConfirmationUrl('https://globalteez.com/', 'tok_abc')).toBe('https://globalteez.com/order-confirmation/tok_abc')
  })
  it('refuses a non-absolute base URL rather than emailing a broken link', () => {
    expect(() => buildConfirmationUrl('globalteez.com', 'tok_abc')).toThrow()
  })
})

describe('summary fingerprint', () => {
  it('same summary produces the same hash', async () => {
    expect(await customerFingerprint(summaryOf())).toBe(await customerFingerprint(summaryOf()))
  })

  it('canonical JSON ignores key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }))
  })

  it('a garment change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const after = await customerFingerprint(summaryOf({ order_garments: [{ ...raw().order_garments[0], colour: 'Navy' }] }))
    expect(after).not.toBe(before)
  })

  it('a quantity change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const after = await customerFingerprint(
      summaryOf({
        order_garments: [
          {
            ...raw().order_garments[0],
            garment_quantities: [
              { size: 'S', quantity: 6 },
              { size: 'M', quantity: 10 },
            ],
          },
        ],
      }),
    )
    expect(after).not.toBe(before)
  })

  it('a service change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const after = await customerFingerprint(summaryOf({ order_services: [] }))
    expect(after).not.toBe(before)
  })

  it('a print width change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const spec = raw().print_specs[0]
    const after = await customerFingerprint(summaryOf({ print_specs: [{ ...spec, width_mm: 120 }] }))
    expect(after).not.toBe(before)
  })

  it('a required date change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const after = await customerFingerprint(summaryOf({ due_date: '2026-11-01' }))
    expect(after).not.toBe(before)
  })

  it('a customer note change changes the hash', async () => {
    const before = await customerFingerprint(summaryOf())
    const after = await customerFingerprint(summaryOf({ notes: 'Different note' }))
    expect(after).not.toBe(before)
  })

  it('an internal-only edit does not change the hash (assignment, statuses, priority, internal notes)', async () => {
    const before = await customerFingerprint(summaryOf())
    const internal = {
      ...raw(),
      assigned_to: 'someone-else',
      production_status: 'Ready',
      garment_status: 'Need Ordering',
      artwork_status: 'Approved',
      payment_status: 'Paid',
      priority: 'Urgent',
      production_notes: 'internal only',
      approval_note: 'internal approval note',
      staff_completed: true,
    } as unknown as RawOrderForEmail
    const after = await customerFingerprint(buildCustomerOrderSummary(internal, {}))
    expect(after).toBe(before)
  })

  it('a changed preview URL alone does not change the hash', async () => {
    const before = await customerFingerprint(summaryOf({}, { 'spec-1': 'https://a.example/x?t=1' }))
    const after = await customerFingerprint(summaryOf({}, { 'spec-1': 'https://a.example/x?t=2' }))
    expect(after).toBe(before)
  })
})

describe('review state', () => {
  it('no row is invalid', () => expect(reviewState(null, 'h', NOW)).toBe('invalid'))
  it('a pending row is pending', () => expect(reviewState(row(), 'hash-a', NOW)).toBe('pending'))
  it('a superseded row is superseded', () => expect(reviewState(row({ status: 'superseded' }), 'hash-a', NOW)).toBe('superseded'))
  it('a confirmed row whose hash still matches is already_confirmed', () => {
    expect(reviewState(row({ status: 'confirmed', summary_hash: 'hash-a' }), 'hash-a', NOW)).toBe('already_confirmed')
  })
  it('a confirmed row whose order has since changed is shown as superseded, never as current', () => {
    expect(reviewState(row({ status: 'confirmed', summary_hash: 'hash-a' }), 'hash-b', NOW)).toBe('superseded')
  })
  it('an expired row is expired (expiry is off by default, so this is the explicit-policy path)', () => {
    expect(reviewState(row({ expires_at: '2026-10-01T00:00:00Z' }), 'hash-a', NOW)).toBe('expired')
  })
})

describe('confirm decision', () => {
  it('pending → confirm when the customer approved exactly what is held now', () => {
    expect(confirmDecision(row(), 'hash-a', 'hash-a', NOW)).toEqual({ action: 'confirm' })
  })
  it('pending → rejected as changed when the order moved on after the page was shown', () => {
    expect(confirmDecision(row(), 'hash-a', 'hash-b', NOW)).toEqual({ action: 'reject', reason: 'changed' })
  })
  it('superseded token cannot confirm', () => {
    expect(confirmDecision(row({ status: 'superseded' }), 'hash-a', 'hash-a', NOW)).toEqual({ action: 'reject', reason: 'superseded' })
  })
  it('unknown token is rejected as invalid', () => {
    expect(confirmDecision(null, 'hash-a', 'hash-a', NOW)).toEqual({ action: 'reject', reason: 'invalid' })
  })
  it('already-confirmed token is idempotent, not an error', () => {
    expect(confirmDecision(row({ status: 'confirmed', summary_hash: 'hash-a', confirmed_at: 'x' }), 'hash-a', 'hash-a', NOW)).toEqual({
      action: 'already_confirmed',
    })
  })
})

describe('supersession', () => {
  it('a customer-facing edit supersedes a confirmed confirmation', () => {
    expect(shouldSupersede(row({ status: 'confirmed', summary_hash: 'hash-a' }), 'hash-b')).toBe(true)
  })
  it('an internal-only edit (hash unchanged) does not supersede', () => {
    expect(shouldSupersede(row({ status: 'confirmed', summary_hash: 'hash-a' }), 'hash-a')).toBe(false)
  })
  it('a pending request is never superseded by a change; it is simply refreshed on next send', () => {
    expect(shouldSupersede(row({ status: 'pending', summary_hash: 'hash-a' }), 'hash-b')).toBe(false)
  })
  it('after supersession a new confirmation can be generated (no active row remains)', () => {
    const rows = [row({ id: 'old', status: 'superseded', summary_hash: 'hash-a' })]
    expect(confirmationStateFromRows(rows, 'hash-b')).toEqual({ kind: 'none' })
  })
  it('planner reports already_confirmed when the active confirmation matches the current order', () => {
    const rows = [row({ status: 'confirmed', summary_hash: 'hash-a' })]
    expect(confirmationStateFromRows(rows, 'hash-a').kind).toBe('already_confirmed')
  })
  it('planner reports supersede when the active confirmation no longer matches', () => {
    const rows = [row({ status: 'confirmed', summary_hash: 'hash-a' })]
    expect(confirmationStateFromRows(rows, 'hash-b').kind).toBe('supersede')
  })
  it('planner reuses a pending row so a retry does not create a second confirmation', () => {
    const rows = [row({ id: 'p1', status: 'pending' })]
    expect(confirmationStateFromRows(rows, 'hash-b')).toMatchObject({ kind: 'pending', row: { id: 'p1' } })
  })
})

describe('confirmation CTA in templates', () => {
  const summary = summaryOf({}, { 'spec-1': 'https://example.supabase.co/preview.png' })
  const url = 'https://globalteez.com/order-confirmation/abc_DEF-123'

  it('staff order summary contains the Review & Confirm Order button', () => {
    const html = renderOrderEmailHtml(summary, 'staff_order_summary', { confirmationUrl: url })
    expect(html).toContain('Review &amp; Confirm Order')
    expect(html).toContain(`href="${url}"`)
  })

  it('staff order summary wording is informational and never implies production has started', () => {
    const html = renderOrderEmailHtml(summary, 'staff_order_summary', { confirmationUrl: url }).toLowerCase()
    expect(html).toContain('if everything looks correct')
    expect(html).not.toContain('payment')
    expect(html).not.toContain('in production')
    expect(html).not.toContain('has started')
  })

  it('updated staff order summary uses updated wording', () => {
    const html = renderOrderEmailHtml(summary, 'staff_order_summary', { confirmationUrl: url, isUpdate: true })
    expect(html).toContain("We&#39;ve updated the order details below.")
  })

  it('public receipt has no confirmation CTA, even if a URL is supplied by mistake', () => {
    const html = renderOrderEmailHtml(summary, 'customer_order_receipt', { confirmationUrl: url })
    const text = renderOrderEmailText(summary, 'customer_order_receipt', { confirmationUrl: url })
    expect(html).not.toContain('Review &amp; Confirm Order')
    expect(text).not.toContain(url)
    expect(html).toContain('Thanks for submitting your order request.')
  })

  it('plain-text version carries the confirmation link too', () => {
    expect(renderOrderEmailText(summary, 'staff_order_summary', { confirmationUrl: url })).toContain(url)
  })

  it('customer-provided content in the confirmation email is HTML-escaped', () => {
    const evil = summaryOf({ notes: '<script>x</script>' })
    const html = renderOrderEmailHtml(evil, 'staff_order_summary', { confirmationUrl: url })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
