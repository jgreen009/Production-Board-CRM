import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types'
import { mapCustomerRowToDomain } from '@/api/mappers/customer'

const SELECT_COLUMNS = 'id, name, company, email, phone, notes, created_at'

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select(SELECT_COLUMNS)
    .order('name', { ascending: true })
  if (error) throw error
  return data.map(mapCustomerRowToDomain)
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    const { data, error } = await supabase
      .from('customers')
      .select(SELECT_COLUMNS)
      .order('name', { ascending: true })
      .limit(6)
    if (error) throw error
    return data.map(mapCustomerRowToDomain)
  }

  const pattern = `%${trimmed}%`
  const { data, error } = await supabase
    .from('customers')
    .select(SELECT_COLUMNS)
    .or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    .order('name', { ascending: true })
    .limit(20)
  if (error) throw error
  return data.map(mapCustomerRowToDomain)
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapCustomerRowToDomain(data) : null
}

export interface CreateCustomerInput {
  name: string
  company?: string
  email?: string
  phone?: string
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name,
      company: input.company || null,
      email: input.email || null,
      phone: input.phone || null,
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return mapCustomerRowToDomain(data)
}

export async function updateCustomerNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase.from('customers').update({ notes }).eq('id', id)
  if (error) throw error
}
