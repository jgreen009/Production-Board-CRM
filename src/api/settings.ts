import { supabase } from '@/lib/supabase'
import { normalizeSupplierUrl } from '@/utils/url'

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

// Mockup System V2 Batch C — garment_types is the one catalog entity
// supplier-link metadata attaches to (see the Batch C handover's audit for
// why: it already has full Settings CRUD, unlike garment_brands, and it's
// the entity garment rendering/geometry keys off). A dedicated shape
// rather than extending the shared CatalogItem, since garment_brands/
// services never carry these columns.
export interface GarmentTypeItem extends CatalogItem {
  supplierName: string
  supplierProductCode: string
  supplierUrl: string
}

export interface GarmentTypeRow extends CatalogRow {
  supplier_name: string | null
  supplier_product_code: string | null
  supplier_url: string | null
}

// Exported (unlike mapCatalogRow) so Batch C's DB->domain mapping is
// directly unit-testable without mocking supabase.
export function mapGarmentTypeRow(row: GarmentTypeRow): GarmentTypeItem {
  return {
    ...mapCatalogRow(row),
    supplierName: row.supplier_name ?? '',
    supplierProductCode: row.supplier_product_code ?? '',
    supplierUrl: row.supplier_url ?? '',
  }
}

export async function listGarmentTypes(): Promise<GarmentTypeItem[]> {
  const { data, error } = await supabase
    .from('garment_types')
    .select('id, name, active, sort_order, supplier_name, supplier_product_code, supplier_url')
    .order('sort_order')
  if (error) throw error
  return (data as GarmentTypeRow[]).map(mapGarmentTypeRow)
}

export const createGarmentType = (name: string) => createCatalogItem('garment_types', name)

export interface UpdateGarmentTypeInput {
  name?: string
  active?: boolean
  supplierName?: string
  supplierProductCode?: string
  /** Rejected (stored as null) if not a safe http/https URL — see utils/url.ts. Supplier data is optional; an unsafe/malformed value never blocks saving the rest of the garment type. */
  supplierUrl?: string
}

// Pure domain->save-payload mapping, exported for direct unit testing
// (Part 13 #2/#3) — an omitted field is never included in the patch at
// all (so a partial save can't accidentally null out fields the caller
// didn't touch), and an empty/unsafe value is normalized to `null` rather
// than rejected outright, since supplier data is optional (Part "Settings
// Validation": never block saving the rest of the garment type).
export function buildGarmentTypeUpdatePatch(patch: UpdateGarmentTypeInput): Record<string, unknown> {
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.active !== undefined) dbPatch.active = patch.active
  if (patch.supplierName !== undefined) dbPatch.supplier_name = patch.supplierName.trim() || null
  if (patch.supplierProductCode !== undefined) dbPatch.supplier_product_code = patch.supplierProductCode.trim() || null
  if (patch.supplierUrl !== undefined) dbPatch.supplier_url = normalizeSupplierUrl(patch.supplierUrl)
  return dbPatch
}

export async function updateGarmentType(id: string, patch: UpdateGarmentTypeInput): Promise<void> {
  const dbPatch = buildGarmentTypeUpdatePatch(patch)
  const { error } = await supabase.from('garment_types').update(dbPatch).eq('id', id)
  if (error) throw error
}

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

// image_storage_path stays unused this phase (Phase 3 Amendment 7 — no
// Storage-backed template upload plumbing is built) — this table is purely
// per-garment/view metadata (name/active), separate from and unrelated to
// the actual rendering source, which is the bundled neutral-silhouette
// system in src/config/garmentTemplates.ts. hasImage is really "has a real
// uploaded template photo" for a later phase, not "has a preview at all" —
// GarmentMockup always has a silhouette to render regardless of this flag.
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
