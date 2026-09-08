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
import type { UpdateBusinessSettingsInput } from '@/api/settings'

function useCatalogQueries(
  key: string,
  list: () => ReturnType<typeof listGarmentTypes>,
  create: (name: string) => ReturnType<typeof createGarmentType>,
  update: (id: string, patch: { name?: string; active?: boolean }) => ReturnType<typeof updateGarmentType>,
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

export function useGarmentTypesSettings() {
  return useCatalogQueries('garment-types', listGarmentTypes, createGarmentType, updateGarmentType)
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
