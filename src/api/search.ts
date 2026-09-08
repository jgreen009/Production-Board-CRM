import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types'
import { mapCustomerRowToDomain } from '@/api/mappers/customer'
import type { CustomerRow } from '@/api/mappers/customer'

export interface OrderSearchResult {
  id: string
  orderNumber: string
  jobName: string
  customer: string
}

export interface GlobalSearchResult {
  orders: OrderSearchResult[]
  customers: Customer[]
}

interface OrderSearchRow {
  id: string
  order_number: string | null
  job_name: string
  customers: { name: string; company: string | null } | null
}

const RESULT_LIMIT = 8

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) return { orders: [], customers: [] }

  const pattern = `%${trimmed}%`

  const [ordersResult, customersResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, job_name, customers ( name, company )')
      .or(`order_number.ilike.${pattern},job_name.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('customers')
      .select('id, name, company, email, phone, notes, created_at')
      .or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .order('name', { ascending: true })
      .limit(RESULT_LIMIT),
  ])

  if (ordersResult.error) throw ordersResult.error
  if (customersResult.error) throw customersResult.error

  const orders: OrderSearchResult[] = (ordersResult.data as unknown as OrderSearchRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number ?? '',
    jobName: row.job_name,
    customer: row.customers ? row.customers.company || row.customers.name : row.job_name,
  }))

  const customers = (customersResult.data as CustomerRow[]).map(mapCustomerRowToDomain)

  return { orders, customers }
}
