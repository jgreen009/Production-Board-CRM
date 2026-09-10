import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  fullName: string | null
  email: string | null
  role: 'owner' | 'admin' | 'staff'
  isActive: boolean
  mustChangePassword: boolean
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, must_change_password')
    .eq('id', userId)
    .single()
  if (error) throw error
  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    isActive: data.is_active,
    mustChangePassword: data.must_change_password,
  }
}

// The one profile field a signed-in user may ever change about
// themselves via a plain PostgREST call — profiles' column-level GRANTs
// (Phase 4 Milestone 1) only permit `authenticated` to UPDATE `full_name`,
// so this is also the only field this function could touch even if asked.
export async function updateOwnFullName(fullName: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)
  if (error) throw error
}

// Changes the CURRENTLY authenticated user's own password — this is a
// plain Supabase Auth client call, not a privileged operation (Auth's
// updateUser only ever affects the caller's own account), so no Edge
// Function is involved here, unlike every admin-users.ts operation.
export async function updateOwnPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Narrow SECURITY DEFINER RPC — clears must_change_password for the
// caller's own row only, and only true -> false. Called after
// updateOwnPassword succeeds, never before.
export async function clearMustChangePassword(): Promise<void> {
  const { error } = await supabase.rpc('clear_must_change_password')
  if (error) throw error
}
