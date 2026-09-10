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

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>('admin-users', { body })
  if (error) throw error
  if (data && 'error' in data && data.error) throw new Error(data.error)
  return data as T
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
