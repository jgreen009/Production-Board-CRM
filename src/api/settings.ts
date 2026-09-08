import { supabase } from '@/lib/supabase'

export interface CatalogItem {
  id: string
  name: string
  active: boolean
  sortOrder: number
}

type CatalogTable = 'garment_types' | 'garment_brands' | 'services'

interface CatalogRow {
  id: string
  name: string
  active: boolean
  sort_order: number
}

function mapCatalogRow(row: CatalogRow): CatalogItem {
  return { id: row.id, name: row.name, active: row.active, sortOrder: row.sort_order }
}

// Shared shape behind garment_types/garment_brands/services — identical
// columns, per plan §3. Lists include inactive rows (unlike everywhere
// else these catalogs are read) so staff can find and re-enable one;
// nothing is ever hard-deleted, toggling active=false is the delete
// action.
async function listCatalog(table: CatalogTable): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from(table).select('id, name, active, sort_order').order('sort_order')
  if (error) throw error
  return (data as CatalogRow[]).map(mapCatalogRow)
}

async function createCatalogItem(table: CatalogTable, name: string): Promise<CatalogItem> {
  const { data: existing, error: countError } = await supabase.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1)
  if (countError) throw countError
  const nextSortOrder = (existing[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from(table)
    .insert({ name, sort_order: nextSortOrder })
    .select('id, name, active, sort_order')
    .single()
  if (error) throw error
  return mapCatalogRow(data as CatalogRow)
}

async function updateCatalogItem(table: CatalogTable, id: string, patch: { name?: string; active?: boolean }): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
}

export const listGarmentTypes = () => listCatalog('garment_types')
export const createGarmentType = (name: string) => createCatalogItem('garment_types', name)
export const updateGarmentType = (id: string, patch: { name?: string; active?: boolean }) =>
  updateCatalogItem('garment_types', id, patch)

export const listGarmentBrands = () => listCatalog('garment_brands')
export const createGarmentBrand = (name: string) => createCatalogItem('garment_brands', name)
export const updateGarmentBrand = (id: string, patch: { name?: string; active?: boolean }) =>
  updateCatalogItem('garment_brands', id, patch)

export const listServices = () => listCatalog('services')
export const createService = (name: string) => createCatalogItem('services', name)
export const updateService = (id: string, patch: { name?: string; active?: boolean }) =>
  updateCatalogItem('services', id, patch)

export interface BusinessSettings {
  id: string
  businessName: string
  businessEmail: string
  businessPhone: string
  standardTurnaroundMinDays: number
  standardTurnaroundMaxDays: number
  orderNumberPrefix: string
}

interface BusinessSettingsRow {
  id: string
  business_name: string
  business_email: string | null
  business_phone: string | null
  standard_turnaround_min_days: number
  standard_turnaround_max_days: number
  order_number_prefix: string
}

function mapBusinessSettingsRow(row: BusinessSettingsRow): BusinessSettings {
  return {
    id: row.id,
    businessName: row.business_name,
    businessEmail: row.business_email ?? '',
    businessPhone: row.business_phone ?? '',
    standardTurnaroundMinDays: row.standard_turnaround_min_days,
    standardTurnaroundMaxDays: row.standard_turnaround_max_days,
    orderNumberPrefix: row.order_number_prefix,
  }
}

// Always exactly one row (business_settings_singleton unique index).
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('business_settings')
    .select('id, business_name, business_email, business_phone, standard_turnaround_min_days, standard_turnaround_max_days, order_number_prefix')
    .single()
  if (error) throw error
  return mapBusinessSettingsRow(data as BusinessSettingsRow)
}

export interface UpdateBusinessSettingsInput {
  businessName: string
  businessEmail: string
  businessPhone: string
  standardTurnaroundMinDays: number
  standardTurnaroundMaxDays: number
  orderNumberPrefix: string
}

export async function updateBusinessSettings(id: string, input: UpdateBusinessSettingsInput): Promise<void> {
  const { error } = await supabase
    .from('business_settings')
    .update({
      business_name: input.businessName,
      business_email: input.businessEmail || null,
      business_phone: input.businessPhone || null,
      standard_turnaround_min_days: input.standardTurnaroundMinDays,
      standard_turnaround_max_days: input.standardTurnaroundMaxDays,
      order_number_prefix: input.orderNumberPrefix,
    })
    .eq('id', id)
  if (error) throw error
}

export interface MockupTemplateItem {
  id: string
  garmentTypeName: string
  view: 'Front' | 'Back'
  name: string
  active: boolean
  hasImage: boolean
}

interface MockupTemplateRow {
  id: string
  name: string
  view: 'Front' | 'Back'
  active: boolean
  image_storage_path: string | null
  garment_types: { name: string } | null
}

// image_storage_path stays unused this phase (see the migration) — the app
// keeps using the local reference photos in src/assets/mockups/, so
// hasImage is really "has a real uploaded template photo" for a later
// phase, not "has a preview at all."
export async function listMockupTemplates(): Promise<MockupTemplateItem[]> {
  const { data, error } = await supabase
    .from('mockup_templates')
    .select('id, name, view, active, image_storage_path, garment_types ( name )')
    .order('sort_order')
  if (error) throw error
  return (data as unknown as MockupTemplateRow[]).map((row) => ({
    id: row.id,
    garmentTypeName: row.garment_types?.name ?? '',
    view: row.view,
    name: row.name,
    active: row.active,
    hasImage: !!row.image_storage_path,
  }))
}

export async function updateMockupTemplateActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('mockup_templates').update({ active }).eq('id', id)
  if (error) throw error
}
