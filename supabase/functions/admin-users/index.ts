// Phase 4 Milestone 1 — the one trusted, server-side path for every
// privileged staff-account operation (create, edit, role change,
// activate/deactivate, password reset). Every Supabase Auth Admin API
// call and every write to a protected `profiles` column happens here,
// never in the browser — the service-role key used below exists only in
// this function's environment, provisioned automatically by Supabase,
// never shipped to any client bundle.
//
// Every request is re-authorized from scratch, server-side: the caller's
// JWT is verified, their profile is looked up fresh from the database,
// and only an active admin/owner may proceed — nothing in the request
// body (role, actorId, an "admin: true" flag, etc.) is ever trusted for
// authorization decisions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// Temporary onboarding password for admin-created accounts and password
// resets. Exists ONLY here — never in React source, a VITE_* env var, a
// database column, an audit message, or any client-visible surface.
const TEMPORARY_PASSWORD = 'saltprints'

const ADMIN_ROLES = new Set(['admin', 'owner'])

// Pre-UAT fix: this function previously had NO CORS handling at all — no
// `Access-Control-Allow-*` headers on any response, and a bare
// `if (req.method !== 'POST') return 405` that also rejected the
// browser's CORS preflight OPTIONS request. A browser calling
// `supabase.functions.invoke()` always sends that OPTIONS preflight
// first; with no CORS headers on the 405 response, the browser blocked
// the real POST entirely and supabase-js surfaced it as "Failed to send
// a request to the Edge Function" — indistinguishable from a network
// failure. Direct curl/HTTP testing never triggers CORS (browsers alone
// enforce it), which is exactly why every prior live-API verification in
// this project passed while a real browser user could not create a user
// at all. `*` is safe here specifically because every response requires
// a valid bearer JWT to do anything privileged — origin restriction adds
// no real security value on top of that, and pinning it to one deploy
// origin would just break every other environment (Netlify previews,
// localhost dev) that legitimately needs to call this function.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// Safe, sanitized step logging only — action name, caller id/role, which
// step was reached, and a sanitized error category. Never a password,
// token, or the service-role key.
function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: 'admin-users', step, ...detail }))
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function countOtherActiveAdmins(admin: ReturnType<typeof adminClient>, excludeId: string): Promise<number> {
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('role', ['admin', 'owner'])
    .eq('is_active', true)
    .neq('id', excludeId)
  return count ?? 0
}

async function logActivity(
  admin: ReturnType<typeof adminClient>,
  actorId: string,
  targetId: string | null,
  activityType: 'user_created' | 'user_activated' | 'user_deactivated' | 'role_changed' | 'password_reset',
  message: string,
) {
  await admin.from('admin_activity').insert({ actor_id: actorId, target_id: targetId, activity_type: activityType, message })
}

interface RequestBody {
  action: 'create' | 'update' | 'setRole' | 'setActive' | 'resetPassword'
  id?: string
  fullName?: string
  email?: string
  role?: string
  isActive?: boolean
}

async function handleCreate(admin: ReturnType<typeof adminClient>, callerId: string, body: RequestBody) {
  const fullName = (body.fullName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'staff'

  if (!fullName || !email) return json({ error: 'Name and email are required' }, 400)

  logStep('create_calling_auth_admin_api', { callerId })
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEMPORARY_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const isDuplicate = (createError?.message ?? '').toLowerCase().includes('already')
    logStep('create_auth_admin_api_failed', { errorCategory: isDuplicate ? 'duplicate_email' : (createError?.name ?? 'unknown') })
    return json({ error: isDuplicate ? 'An account with this email already exists.' : 'Unable to create user. Please try again.' }, 400)
  }

  const newId = created.user.id
  logStep('create_auth_user_created', { newId })

  // handle_new_user() already inserted a bare profile row (id/full_name/
  // email) via the AFTER INSERT trigger — this sets the fields it can't
  // know about (role, the onboarding flags) and re-affirms the rest.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, role, is_active: true, must_change_password: true })
    .eq('id', newId)

  if (profileError) {
    logStep('create_profile_update_failed', { newId, errorCategory: profileError.code ?? 'unknown' })
    // Never leave an orphaned Auth user with no usable profile.
    await admin.auth.admin.deleteUser(newId)
    return json({ error: 'Unable to create user. Please try again.' }, 500)
  }

  await logActivity(admin, callerId, newId, 'user_created', `User created: ${fullName}`)
  logStep('create_succeeded', { newId })
  return json({ id: newId, fullName, email, role, isActive: true }, 200)
}

async function handleUpdate(admin: ReturnType<typeof adminClient>, _callerId: string, body: RequestBody) {
  const id = body.id ?? ''
  const fullName = (body.fullName ?? '').trim()
  if (!id || !fullName) return json({ error: 'Missing required fields' }, 400)

  const { error } = await admin.from('profiles').update({ full_name: fullName }).eq('id', id)
  if (error) return json({ error: 'Failed to update user' }, 500)
  return json({ ok: true }, 200)
}

async function handleSetRole(admin: ReturnType<typeof adminClient>, callerId: string, body: RequestBody) {
  const id = body.id ?? ''
  const role = body.role === 'admin' ? 'admin' : body.role === 'staff' ? 'staff' : null
  if (!id || !role) return json({ error: 'Invalid request' }, 400)

  const { data: target } = await admin.from('profiles').select('role, is_active, full_name').eq('id', id).single()
  if (!target) return json({ error: 'User not found' }, 404)

  const isDemotingAnActiveAdmin = ADMIN_ROLES.has(target.role) && role === 'staff' && target.is_active
  if (isDemotingAnActiveAdmin) {
    const remaining = await countOtherActiveAdmins(admin, id)
    if (remaining === 0) return json({ error: 'Cannot demote the last active administrator' }, 400)
  }

  const { error } = await admin.from('profiles').update({ role }).eq('id', id)
  if (error) return json({ error: 'Failed to update role' }, 500)

  await logActivity(admin, callerId, id, 'role_changed', `Role changed to ${role} for ${target.full_name ?? id}`)
  return json({ ok: true }, 200)
}

async function handleSetActive(admin: ReturnType<typeof adminClient>, callerId: string, body: RequestBody) {
  const id = body.id ?? ''
  const isActive = body.isActive === true
  if (!id) return json({ error: 'Invalid request' }, 400)

  const { data: target } = await admin.from('profiles').select('role, is_active, full_name').eq('id', id).single()
  if (!target) return json({ error: 'User not found' }, 404)

  const isDeactivatingAnActiveAdmin = !isActive && target.is_active && ADMIN_ROLES.has(target.role)
  if (isDeactivatingAnActiveAdmin) {
    const remaining = await countOtherActiveAdmins(admin, id)
    if (remaining === 0) return json({ error: 'Cannot deactivate the last active administrator' }, 400)
  }

  const { error: profileError } = await admin.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (profileError) return json({ error: 'Failed to update status' }, 500)

  // Real authentication enforcement, not just a UI flag — ban/unban the
  // Auth account itself. ~100 years is Supabase's own documented pattern
  // for an effectively-indefinite ban (there is no explicit "forever").
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? 'none' : '876000h',
  })
  if (banError) {
    await admin.from('profiles').update({ is_active: !isActive }).eq('id', id)
    return json({ error: 'Failed to update authentication status' }, 500)
  }

  await logActivity(
    admin,
    callerId,
    id,
    isActive ? 'user_activated' : 'user_deactivated',
    `${isActive ? 'Activated' : 'Deactivated'} ${target.full_name ?? id}`,
  )
  return json({ ok: true }, 200)
}

async function handleResetPassword(admin: ReturnType<typeof adminClient>, callerId: string, body: RequestBody) {
  const id = body.id ?? ''
  if (!id) return json({ error: 'Invalid request' }, 400)

  const { data: target } = await admin.from('profiles').select('full_name').eq('id', id).single()
  if (!target) return json({ error: 'User not found' }, 404)

  const { error: pwError } = await admin.auth.admin.updateUserById(id, { password: TEMPORARY_PASSWORD })
  if (pwError) return json({ error: 'Failed to reset password' }, 500)

  const { error: profileError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', id)
  if (profileError) {
    return json({ error: 'Password reset but the account may not prompt a change — contact support' }, 500)
  }

  await logActivity(admin, callerId, id, 'password_reset', `Password reset required for ${target.full_name ?? id}`)
  return json({ ok: true }, 200)
}

Deno.serve(async (req: Request) => {
  // The browser's CORS preflight — must succeed with the CORS headers
  // present, or the browser never sends the actual POST at all.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      logStep('missing_authorization')
      return json({ error: 'Missing authorization' }, 401)
    }

    const admin = adminClient()

    // Resolve the caller from their own JWT, server-side — never trust
    // any identity claim in the request body.
    const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(token)
    if (callerAuthError || !callerAuth.user) {
      logStep('caller_jwt_invalid', { errorCategory: callerAuthError?.name ?? 'no_user' })
      return json({ error: 'Your session has expired. Please sign in again.' }, 401)
    }
    const callerId = callerAuth.user.id

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .single()

    if (callerProfileError || !callerProfile) {
      logStep('caller_profile_lookup_failed', { callerId })
      return json({ error: 'Unauthorized' }, 403)
    }
    if (!callerProfile.is_active) {
      logStep('caller_inactive', { callerId })
      return json({ error: 'Your account is inactive.' }, 403)
    }
    if (!ADMIN_ROLES.has(callerProfile.role)) {
      logStep('caller_not_admin', { callerId, callerRole: callerProfile.role })
      return json({ error: 'You do not have permission to manage users.' }, 403)
    }

    const body = (await req.json()) as RequestBody
    logStep('authorized', { callerId, callerRole: callerProfile.role, action: body.action })

    switch (body.action) {
      case 'create':
        return await handleCreate(admin, callerId, body)
      case 'update':
        return await handleUpdate(admin, callerId, body)
      case 'setRole':
        return await handleSetRole(admin, callerId, body)
      case 'setActive':
        return await handleSetActive(admin, callerId, body)
      case 'resetPassword':
        return await handleResetPassword(admin, callerId, body)
      default:
        logStep('unknown_action', { action: body.action })
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (err) {
    logStep('unhandled_exception', { errorCategory: err instanceof Error ? err.name : typeof err })
    console.error(err)
    return json({ error: 'User Management service is temporarily unavailable. Please try again.' }, 500)
  }
})
