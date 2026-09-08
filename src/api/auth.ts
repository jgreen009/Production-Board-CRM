import { supabase } from '@/lib/supabase'

export interface Profile {
  id: string
  fullName: string | null
  role: 'owner' | 'admin' | 'staff'
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
    .select('id, full_name, role')
    .eq('id', userId)
    .single()
  if (error) throw error
  return { id: data.id, fullName: data.full_name, role: data.role }
}
