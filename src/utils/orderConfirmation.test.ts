import { describe, expect, it } from 'vitest'
import { confirmationDisplayFor, type ConfirmationRecord } from './orderConfirmation'

function rec(overrides: Partial<ConfirmationRecord>): ConfirmationRecord {
  return {
    status: 'pending',
    sentAt: null,
    confirmedAt: null,
    customerEmail: 'dave@example.com',
    createdAt: '2026-10-03T10:00:00Z',
    ...overrides,
  }
}

describe('confirmationDisplayFor', () => {
  it('no rows → Not Sent', () => {
    expect(confirmationDisplayFor([])).toEqual({ state: 'not_sent' })
  })
  it('pending and sent → Awaiting Confirmation', () => {
    expect(confirmationDisplayFor([rec({ sentAt: '2026-10-03T10:01:00Z' })]).state).toBe('awaiting')
  })
  it('pending but never sent stays Not Sent (a failed send is not "awaiting")', () => {
    expect(confirmationDisplayFor([rec({ sentAt: null })]).state).toBe('not_sent')
  })
  it('confirmed → Customer Confirmed with timestamp and email', () => {
    expect(
      confirmationDisplayFor([rec({ status: 'confirmed', confirmedAt: '2026-10-03T16:42:00Z', sentAt: '2026-10-03T10:01:00Z' })]),
    ).toEqual({ state: 'confirmed', confirmedAt: '2026-10-03T16:42:00Z', customerEmail: 'dave@example.com' })
  })
  it('superseded with no active row → Needs Reconfirmation', () => {
    expect(confirmationDisplayFor([rec({ status: 'superseded', createdAt: '2026-10-03T10:00:00Z' })]).state).toBe(
      'needs_reconfirmation',
    )
  })
  it('a new pending after a superseded one reads as awaiting, not needs reconfirmation', () => {
    const records = [
      rec({ status: 'superseded', createdAt: '2026-10-03T10:00:00Z' }),
      rec({ status: 'pending', sentAt: '2026-10-04T09:00:00Z', createdAt: '2026-10-04T08:59:00Z' }),
    ]
    expect(confirmationDisplayFor(records).state).toBe('awaiting')
  })
  it('uses the newest row even if the input is unsorted', () => {
    const records = [
      rec({ status: 'superseded', createdAt: '2026-10-01T00:00:00Z' }),
      rec({ status: 'confirmed', confirmedAt: '2026-10-03T00:00:00Z', createdAt: '2026-10-02T00:00:00Z' }),
    ]
    expect(confirmationDisplayFor(records).state).toBe('confirmed')
  })
})
