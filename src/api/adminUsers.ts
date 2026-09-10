import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/api/auth'

// Every privileged staff-account operation goes through the admin-users
// Edge Function (Phase 4 Milestone 1) — never a direct table write, never
// the Auth Admin API from the browser. `supabase.functions.invoke`
// forwards the current session's JWT automatically; the function
// re-derives and re-checks the caller's admin status itself, so nothing
// here needs to (or should) pre-check role — hiding a button is not
// authorization, the server call is.

export interface AdminUserRow {
  id: string
  fullName: string | null
  email: string | null
  role: 'owner' | 'admin' | 'staff'
  isActive: boolean
}

function mapProfileRow(row: {
  id: string
  full_name: string | null
  email: string | null
  role: 'owner' | 'admin' | 'staff'
  is_active: boolean
}): AdminUserRow {
  return { id: row.id, fullName: row.full_name, email: row.email, role: row.role, isActive: row.is_active }
}

// Plain SELECT, not privileged — RLS already lets an admin/owner read
// every profile row (staff can only ever read their own, so this query
// naturally returns just their own row if a non-admin somehow reaches it).
export async function listUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .order('full_name', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map(mapProfileRow)
}

// The admin-users function always returns a real HTTP status code on
// failure (400/401/403/404/500 with a JSON `{ error }` body), never a 200
// with an error field inside it — so supabase-js never populates `data`
// on failure; it throws a `FunctionsHttpError` whose JSON body lives on
// `error.context` (a Response) instead. The previous `data.error` check
// here was dead code that could never fire against this function's
// actual response shape. This also distinguishes the CORS/network
// failure case (`FunctionsFetchError` — the one that previously surfaced
// to staff as the raw, meaningless "Failed to send a request to the Edge
// Function") from a real server-side rejection, so each gets its own
// safe, specific message instead of a raw fetch error leaking through.
async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const serverMessage = await readServerErrorMessage(error)
      throw new Error(serverMessage ?? 'Unable to complete this action. Please try again.')
    }
    if (error instanceof FunctionsFetchError) {
      throw new Error('Unable to reach the User Management service. Check your connection and try again.')
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error('User Management service is temporarily unavailable. Please try again.')
    }
    throw new Error('Something went wrong. Please try again.')
  }

  return data as T
}

async function readServerErrorMessage(error: FunctionsHttpError): Promise<string | null> {
  try {
    const body = await error.context.clone().json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

export async function createUser(input: { fullName: string; email: string; role: 'admin' | 'staff' }): Promise<AdminUserRow> {
  const result = await invokeAdminUsers<{ id: string; fullName: string; email: string; role: string; isActive: boolean }>({
    action: 'create',
    fullName: input.fullName,
    email: input.email,
    role: input.role,
  })
  return { id: result.id, fullName: result.fullName, email: result.email, role: result.role as Profile['role'], isActive: result.isActive }
}

export async function updateUserName(id: string, fullName: string): Promise<void> {
  await invokeAdminUsers({ action: 'update', id, fullName })
}

export async function setUserRole(id: string, role: 'admin' | 'staff'): Promise<void> {
  await invokeAdminUsers({ action: 'setRole', id, role })
}

export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  await invokeAdminUsers({ action: 'setActive', id, isActive })
}

export async function resetUserPassword(id: string): Promise<void> {
  await invokeAdminUsers({ action: 'resetPassword', id })
}
