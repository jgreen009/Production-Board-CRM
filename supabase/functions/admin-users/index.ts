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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEMPORARY_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const isDuplicate = (createError?.message ?? '').toLowerCase().includes('already')
    return json({ error: isDuplicate ? 'An account with this email already exists' : 'Failed to create user' }, 400)
  }

  const newId = created.user.id

  // handle_new_user() already inserted a bare profile row (id/full_name/
  // email) via the AFTER INSERT trigger — this sets the fields it can't
  // know about (role, the onboarding flags) and re-affirms the rest.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, role, is_active: true, must_change_password: true })
    .eq('id', newId)

  if (profileError) {
    // Never leave an orphaned Auth user with no usable profile.
    await admin.auth.admin.deleteUser(newId)
    return json({ error: 'Failed to set up the new user — please try again' }, 500)
  }

  await logActivity(admin, callerId, newId, 'user_created', `User created: ${fullName}`)
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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Missing authorization' }, 401)

    const admin = adminClient()

    // Resolve the caller from their own JWT, server-side — never trust
    // any identity claim in the request body.
    const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(token)
    if (callerAuthError || !callerAuth.user) return json({ error: 'Unauthorized' }, 401)
    const callerId = callerAuth.user.id

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerId)
      .single()

    if (callerProfileError || !callerProfile) return json({ error: 'Unauthorized' }, 403)
    if (!callerProfile.is_active) return json({ error: 'Account inactive' }, 403)
    if (!ADMIN_ROLES.has(callerProfile.role)) return json({ error: 'Forbidden' }, 403)

    const body = (await req.json()) as RequestBody

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
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (err) {
    console.error(err)
    return json({ error: 'Unexpected error' }, 500)
  }
})
