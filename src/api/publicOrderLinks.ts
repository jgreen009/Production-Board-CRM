import { supabase } from '@/lib/supabase'
import { generateOrderLinkToken } from '@/utils/publicOrderLink'

export interface PublicOrderLink {
  id: string
  isActive: boolean
  expiresAt: string | null
  /** null means "no limit" — the general link always uses this; one-time links keep a real number (default 1). */
  maxSubmissions: number | null
  submissionCount: number
  resultingOrderId: string | null
  createdAt: string
  isGeneral: boolean
  /**
   * Only ever populated for the general link — the raw, shareable token,
   * persisted so any authenticated staff member can retrieve/copy it
   * again later, from anywhere in the app, not just at creation time.
   * Always null for a one-time link (never stored for those, by design —
   * see the migration's own comment).
   */
  rawToken: string | null
}

interface PublicOrderLinkRow {
  id: string
  is_active: boolean
  expires_at: string | null
  max_submissions: number | null
  submission_count: number
  resulting_order_id: string | null
  created_at: string
  is_general: boolean
  raw_token: string | null
}

function mapRow(row: PublicOrderLinkRow): PublicOrderLink {
  return {
    id: row.id,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    maxSubmissions: row.max_submissions,
    submissionCount: row.submission_count,
    resultingOrderId: row.resulting_order_id,
    createdAt: row.created_at,
    isGeneral: row.is_general,
    rawToken: row.raw_token,
  }
}

const SELECT_COLUMNS =
  'id, is_active, expires_at, max_submissions, submission_count, resulting_order_id, created_at, is_general, raw_token'

export async function listPublicOrderLinks(): Promise<PublicOrderLink[]> {
  const { data, error } = await supabase
    .from('public_order_links')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as PublicOrderLinkRow[]).map(mapRow)
}

export interface CreatePublicOrderLinkInput {
  tokenHash: string
  expiresAt?: string | null
}

// Only the hash is ever written for a one-time link — the raw token this
// hash was derived from (generated client-side, see utils/publicOrderLink.ts)
// is shown to staff once, in the success response of the creation UI, and
// never sent here or stored anywhere. (The general link is the one
// deliberate exception — see createGeneralOrderLink below.)
export async function createPublicOrderLink(input: CreatePublicOrderLinkInput): Promise<PublicOrderLink> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('public_order_links')
    .insert({ token_hash: input.tokenHash, expires_at: input.expiresAt ?? null, created_by: user?.id ?? null })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return mapRow(data as PublicOrderLinkRow)
}

export async function revokePublicOrderLink(id: string): Promise<void> {
  const { error } = await supabase.from('public_order_links').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------
// General order link — one persistent, unlimited-use link, reusable
// indefinitely and meant to be copied from multiple places in the app
// (e.g. Orders' header, the dedicated link-management page) rather than
// staff generating a fresh single-use link per customer. A partial unique
// index (is_general AND is_active) enforces "only one active general link
// exists" at the database level — getOrCreateGeneralOrderLink() below is
// how the app finds the existing one or creates the first one, and
// regenerateGeneralOrderLink() is how staff rotate it (revoke the old one,
// which frees the unique-index slot, then create a new one).
// ---------------------------------------------------------------------

export async function getActiveGeneralOrderLink(): Promise<PublicOrderLink | null> {
  const { data, error } = await supabase
    .from('public_order_links')
    .select(SELECT_COLUMNS)
    .eq('is_general', true)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data as PublicOrderLinkRow) : null
}

async function createGeneralOrderLink(): Promise<PublicOrderLink> {
  const { token, tokenHash } = await generateOrderLinkToken()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('public_order_links')
    .insert({
      token_hash: tokenHash,
      raw_token: token,
      is_general: true,
      max_submissions: null,
      expires_at: null,
      created_by: user?.id ?? null,
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return mapRow(data as PublicOrderLinkRow)
}

// Finds the existing active general link if one exists; otherwise creates
// the first one. Safe to call from anywhere the app wants to display/copy
// "the" order link — it never creates a second one while an active one
// already exists (enforced by the unique index, not just this check —
// a race between two calls would have the loser's insert fail against the
// index rather than silently create a duplicate).
export async function getOrCreateGeneralOrderLink(): Promise<PublicOrderLink> {
  const existing = await getActiveGeneralOrderLink()
  if (existing) return existing
  return createGeneralOrderLink()
}

// Revokes the current general link and immediately creates a new one —
// "regenerate." The old link stops working the moment this resolves;
// anyone who still has the old URL sees the normal revoked-link message.
export async function regenerateGeneralOrderLink(currentId: string): Promise<PublicOrderLink> {
  await revokePublicOrderLink(currentId)
  return createGeneralOrderLink()
}
