import type { PublicOrderLink } from '@/api/publicOrderLinks'

export type PublicOrderLinkStatus = 'Active' | 'Used' | 'Expired' | 'Revoked'

// Pure — the single place "what state is this link in" is decided, so the
// staff list UI and any future surface (e.g. the badge on a resulting
// order) can never disagree. Priority: revoked (explicit staff action)
// wins over everything else, then expiry, then used-up, then active.
export function getPublicOrderLinkStatus(link: PublicOrderLink, now: Date = new Date()): PublicOrderLinkStatus {
  if (!link.isActive) return 'Revoked'
  if (link.expiresAt && new Date(link.expiresAt).getTime() < now.getTime()) return 'Expired'
  if (link.submissionCount >= link.maxSubmissions) return 'Used'
  return 'Active'
}
