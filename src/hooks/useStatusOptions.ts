import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStatusOption,
  deleteStatusOption,
  listStatusOptions,
  updateStatusOption,
} from '@/api/statusOptions'
import type {
  CreateStatusOptionInput,
  StatusColor,
  StatusDimension,
  StatusOption,
  UpdateStatusOptionInput,
} from '@/api/statusOptions'
import type { StatusConfig } from '@/data/mockStatuses'

const COLOR_CLASSNAME: Record<StatusColor, string> = {
  neutral: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  danger: 'bg-danger-soft text-danger border-danger/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  success: 'bg-success-soft text-success border-success/20',
  info: 'bg-info-soft text-info border-info/20',
}

export function toStatusConfig(option: StatusOption): StatusConfig<string> {
  return { value: option.value, label: option.label, className: COLOR_CLASSNAME[option.color] }
}

const QUERY_KEY = ['catalog', 'status-options']

// Settings' CRUD UI needs every dimension + inactive rows at once; this is
// the one query all the per-dimension hooks below derive from client-side,
// so a create/rename/delete in Settings invalidates a single cache key and
// every StatusBadge/StatusSelect on screen picks it up.
export function useStatusOptions() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listStatusOptions })
}

// Active-only, sorted, this-dimension-only — the shape StatusSelect and
// StatusBadge actually want. Falls back to an empty array while loading so
// callers can render immediately with a neutral/loading state instead of
// branching on isLoading everywhere status configs are consumed.
export function useStatusOptionsByDimension(dimension: StatusDimension): StatusConfig<string>[] {
  const { data } = useStatusOptions()
  return useMemo(
    () =>
      (data ?? [])
        .filter((o) => o.dimension === dimension && o.active)
        .map(toStatusConfig),
    [data, dimension],
  )
}

// Includes inactive rows — used to resolve a badge/label for a status value
// that has since been deactivated but is still set on an existing order
// (the DB trigger explicitly allows this; the UI must still be able to
// display it).
export function useAllStatusOptionsByDimension(dimension: StatusDimension): StatusConfig<string>[] {
  const { data } = useStatusOptions()
  return useMemo(
    () => (data ?? []).filter((o) => o.dimension === dimension).map(toStatusConfig),
    [data, dimension],
  )
}

export function useCreateStatusOption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStatusOptionInput) => createStatusOption(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateStatusOption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateStatusOptionInput }) => updateStatusOption(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteStatusOption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (option: StatusOption) => deleteStatusOption(option),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
