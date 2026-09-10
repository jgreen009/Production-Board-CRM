import { supabase } from '@/lib/supabase'

export interface ActiveStaffOption {
  id: string
  fullName: string | null
  role: 'owner' | 'admin' | 'staff'
}

// The one reusable "who can this order be assigned to" query — every
// AssigneeSelector instance (New/Edit Order, Order Detail, Production
// Board) goes through this, never its own independent filter, per the
// plan's "do not duplicate staff filtering independently in each
// selector." Deliberately only the safe fields a selector needs — no
// email, no Auth metadata (profiles' SELECT RLS allows reading every
// column, but there's no reason for this query to ask for more than it
// uses).
export async function listActiveStaff(): Promise<ActiveStaffOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name, role: row.role }))
}
