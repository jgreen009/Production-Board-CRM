import { supabase } from '@/lib/supabase'

export type StatusDimension = 'payment' | 'artwork' | 'garment' | 'production' | 'priority' | 'turnaround'

export type StatusColor = 'neutral' | 'danger' | 'warning' | 'success' | 'info'

export interface StatusOption {
  id: string
  dimension: StatusDimension
  value: string
  label: string
  color: StatusColor
  isSystem: boolean
  active: boolean
  sortOrder: number
}

interface StatusOptionRow {
  id: string
  dimension: StatusDimension
  value: string
  label: string
  color: StatusColor
  is_system: boolean
  active: boolean
  sort_order: number
}

function mapRow(row: StatusOptionRow): StatusOption {
  return {
    id: row.id,
    dimension: row.dimension,
    value: row.value,
    label: row.label,
    color: row.color,
    isSystem: row.is_system,
    active: row.active,
    sortOrder: row.sort_order,
  }
}

const SELECT_COLUMNS = 'id, dimension, value, label, color, is_system, active, sort_order'

// Lists ALL rows (active and inactive) across every dimension in one round
// trip — Settings needs every dimension's full catalog at once (unlike
// StatusSelect/StatusBadge, which filter this down to one active-only
// dimension client-side via useStatusOptionsByDimension).
export async function listStatusOptions(): Promise<StatusOption[]> {
  const { data, error } = await supabase.from('status_options').select(SELECT_COLUMNS).order('dimension').order('sort_order')
  if (error) throw error
  return (data as StatusOptionRow[]).map(mapRow)
}

export interface CreateStatusOptionInput {
  dimension: StatusDimension
  label: string
  color: StatusColor
}

// New custom statuses are never is_system — only the seed migration sets
// that flag. `value` is set once here, equal to the initial label, and is
// never touched again by any update — this is what keeps a later rename
// from breaking business logic that compares against `value`.
export async function createStatusOption(input: CreateStatusOptionInput): Promise<StatusOption> {
  const { data: existing, error: countError } = await supabase
    .from('status_options')
    .select('sort_order')
    .eq('dimension', input.dimension)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (countError) throw countError
  const nextSortOrder = (existing[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('status_options')
    .insert({
      dimension: input.dimension,
      value: input.label,
      label: input.label,
      color: input.color,
      is_system: false,
      sort_order: nextSortOrder,
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return mapRow(data as StatusOptionRow)
}

export interface UpdateStatusOptionInput {
  label?: string
  color?: StatusColor
  active?: boolean
}

// Renaming only ever changes `label`, never `value` — every hardcoded
// `=== 'Completed'`-style comparison elsewhere in the app keeps working
// after an admin renames a status's display text.
export async function updateStatusOption(id: string, patch: UpdateStatusOptionInput): Promise<void> {
  const { error } = await supabase.from('status_options').update(patch).eq('id', id)
  if (error) throw error
}

// Client-side guardrails before ever attempting the delete — is_system
// statuses (every seeded value) and any status currently in use on at
// least one order are refused, since either would either strand
// historical/DB-trigger-validated data or remove something business logic
// depends on. Delete is still also blocked at the RLS layer to admin/owner
// only, but there is no DB-side is_system/in-use guard (Postgres has no
// clean way to express "in use" against 6 different orders columns behind
// a delete-time check without another trigger); this function is the only
// enforcement of those two rules, so every delete entry point must go
// through it rather than calling supabase directly.
// Pure guard, exported for direct unit testing without mocking supabase —
// mirrors the settings.ts buildGarmentTypeUpdatePatch pattern of keeping
// the actual business rule in a plain function separate from the I/O.
export function assertDeletable(option: StatusOption): void {
  if (option.isSystem) {
    throw new Error(`"${option.label}" is a built-in status and can't be deleted. You can disable it instead.`)
  }
}

export async function deleteStatusOption(option: StatusOption): Promise<void> {
  assertDeletable(option)

  const orderColumn = ORDER_COLUMN_BY_DIMENSION[option.dimension]
  const { count, error: countError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq(orderColumn, option.value)
  if (countError) throw countError
  if ((count ?? 0) > 0) {
    throw new Error(`"${option.label}" is currently used by ${count} order${count === 1 ? '' : 's'} and can't be deleted. Disable it instead.`)
  }

  const { error } = await supabase.from('status_options').delete().eq('id', option.id)
  if (error) throw error
}

const ORDER_COLUMN_BY_DIMENSION: Record<StatusDimension, string> = {
  payment: 'payment_status',
  artwork: 'artwork_status',
  garment: 'garment_status',
  production: 'production_status',
  priority: 'priority',
  turnaround: 'turnaround_type',
}
