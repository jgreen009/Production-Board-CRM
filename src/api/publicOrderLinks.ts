import { supabase } from '@/lib/supabase'

export interface PublicOrderLink {
  id: string
  isActive: boolean
  expiresAt: string | null
  maxSubmissions: number
  submissionCount: number
  resultingOrderId: string | null
  createdAt: string
}

interface PublicOrderLinkRow {
  id: string
  is_active: boolean
  expires_at: string | null
  max_submissions: number
  submission_count: number
  resulting_order_id: string | null
  created_at: string
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
  }
}

const SELECT_COLUMNS = 'id, is_active, expires_at, max_submissions, submission_count, resulting_order_id, created_at'

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

// Only the hash is ever written — the raw token this hash was derived
// from (generated client-side, see utils/publicOrderLink.ts) is shown to
// staff once, in the success response of the creation UI, and never sent
// here or stored anywhere.
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
