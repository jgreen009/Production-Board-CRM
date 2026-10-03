// Staff authorization for Edge Functions that run with verify_jwt disabled or
// that need the caller's identity. A bearer token must verify AND belong to an
// active profile. Nothing in the request body is ever used for this decision.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export async function requireActiveStaff(
  admin: SupabaseClient,
  authorizationHeader: string | null,
): Promise<{ ok: true; userId: string } | { ok: false; status: 401 | 403 }> {
  const header = authorizationHeader ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!jwt) return { ok: false, status: 401 }

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return { ok: false, status: 401 }

  const { data: profile } = await admin
    .from('profiles')
    .select('is_active')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (!profile || !profile.is_active) return { ok: false, status: 403 }

  return { ok: true, userId: userData.user.id }
}
