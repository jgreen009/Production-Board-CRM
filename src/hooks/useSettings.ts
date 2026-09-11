import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createGarmentBrand,
  createGarmentType,
  createService,
  getBusinessSettings,
  listGarmentBrands,
  listGarmentTypes,
  listMockupTemplates,
  listServices,
  updateBusinessSettings,
  updateGarmentBrand,
  updateGarmentType,
  updateMockupTemplateActive,
  updateService,
} from '@/api/settings'
import type { CatalogItem, UpdateBusinessSettingsInput, UpdateGarmentTypeInput } from '@/api/settings'

// Shared by garment_brands/services, which both still use the plain
// {name?, active?} patch shape — garment_types diverged (Batch C: supplier
// fields) and gets its own dedicated hook below instead.
function useCatalogQueries(
  key: string,
  list: () => Promise<CatalogItem[]>,
  create: (name: string) => Promise<CatalogItem>,
  update: (id: string, patch: { name?: string; active?: boolean }) => Promise<void>,
) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['catalog', key], queryFn: list })

  const createMutation = useMutation({
    mutationFn: create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', key] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; active?: boolean } }) => update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', key] }),
  })

  return { ...query, create: createMutation, update: updateMutation }
}

// Mockup System V2 Batch C: garment types carry richer, garment-type-only
// fields (supplier name/product code/URL) that garment_brands/services
// never do, so this isn't built on the shared useCatalogQueries factory
// above (which is typed to the narrow {name?, active?} patch every other
// catalog uses) — same list/create/update-with-invalidation shape, just
// with UpdateGarmentTypeInput's wider patch type.
export function useGarmentTypesSettings() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['catalog', 'garment-types'], queryFn: listGarmentTypes })

  const createMutation = useMutation({
    mutationFn: createGarmentType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'garment-types'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateGarmentTypeInput }) => updateGarmentType(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'garment-types'] }),
  })

  return { ...query, create: createMutation, update: updateMutation }
}

export function useGarmentBrandsSettings() {
  return useCatalogQueries('garment-brands', listGarmentBrands, createGarmentBrand, updateGarmentBrand)
}

export function useServicesSettings() {
  return useCatalogQueries('services', listServices, createService, updateService)
}

export function useBusinessSettings() {
  return useQuery({ queryKey: ['settings', 'business'], queryFn: getBusinessSettings })
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBusinessSettingsInput }) => updateBusinessSettings(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'business'] }),
  })
}

export function useMockupTemplates() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['catalog', 'mockup-templates'], queryFn: listMockupTemplates })

  const updateActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateMockupTemplateActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'mockup-templates'] }),
  })

  return { ...query, updateActive }
}
