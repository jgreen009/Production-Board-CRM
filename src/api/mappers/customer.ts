import type { Customer } from '@/types'

// Matches the shape returned by `select('id, name, company, email, phone, notes, created_at')`.
export interface CustomerRow {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export function mapCustomerRowToDomain(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}
