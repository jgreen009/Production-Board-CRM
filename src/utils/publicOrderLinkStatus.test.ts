import { describe, expect, it } from 'vitest'
import { getPublicOrderLinkStatus } from './publicOrderLinkStatus'
import type { PublicOrderLink } from '@/api/publicOrderLinks'

function baseLink(overrides: Partial<PublicOrderLink> = {}): PublicOrderLink {
  return {
    id: 'link-1',
    isActive: true,
    expiresAt: null,
    maxSubmissions: 1,
    submissionCount: 0,
    resultingOrderId: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('getPublicOrderLinkStatus', () => {
  it('is Active for a fresh, unused, unexpired link', () => {
    expect(getPublicOrderLinkStatus(baseLink())).toBe('Active')
  })

  it('is Revoked when is_active is false, regardless of other fields', () => {
    expect(getPublicOrderLinkStatus(baseLink({ isActive: false }))).toBe('Revoked')
  })

  it('is Used when submission_count has reached max_submissions', () => {
    expect(getPublicOrderLinkStatus(baseLink({ submissionCount: 1, maxSubmissions: 1 }))).toBe('Used')
  })

  it('is Expired when expires_at is in the past', () => {
    const link = baseLink({ expiresAt: '2020-01-01T00:00:00Z' })
    expect(getPublicOrderLinkStatus(link, new Date('2026-01-01T00:00:00Z'))).toBe('Expired')
  })

  it('is not Expired when expires_at is in the future', () => {
    const link = baseLink({ expiresAt: '2030-01-01T00:00:00Z' })
    expect(getPublicOrderLinkStatus(link, new Date('2026-01-01T00:00:00Z'))).toBe('Active')
  })

  it('Revoked takes priority over Used and Expired', () => {
    const link = baseLink({ isActive: false, submissionCount: 1, maxSubmissions: 1, expiresAt: '2020-01-01T00:00:00Z' })
    expect(getPublicOrderLinkStatus(link, new Date('2026-01-01T00:00:00Z'))).toBe('Revoked')
  })

  it('Expired takes priority over Used when both are true', () => {
    const link = baseLink({ submissionCount: 1, maxSubmissions: 1, expiresAt: '2020-01-01T00:00:00Z' })
    expect(getPublicOrderLinkStatus(link, new Date('2026-01-01T00:00:00Z'))).toBe('Expired')
  })
})
