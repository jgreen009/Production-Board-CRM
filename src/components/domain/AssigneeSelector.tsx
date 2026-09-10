import { Select } from '@/components/ui/Field'
import { useActiveStaff } from '@/hooks/useStaff'

interface AssigneeSelectorProps {
  value: string | undefined
  onChange: (id: string | undefined) => void
  // The order's CURRENT assignee, for when they're no longer active —
  // never offered as a selectable option, but shown so the field doesn't
  // silently blank out a real historical value.
  currentAssigneeName?: string | null
  currentAssigneeActive?: boolean
  disabled?: boolean
  id?: string
}

// The one reusable assignee picker (New/Edit Order, Order Detail,
// Production Board Quick View) — always backed by useActiveStaff(), never
// a component-local filter, so "who's assignable" can never drift between
// surfaces.
export function AssigneeSelector({
  value,
  onChange,
  currentAssigneeName,
  currentAssigneeActive,
  disabled,
  id,
}: AssigneeSelectorProps) {
  const { data: staff = [], isLoading } = useActiveStaff()
  const showInactiveCurrent = !!value && currentAssigneeActive === false

  return (
    <Select
      id={id}
      value={value ?? ''}
      disabled={disabled || isLoading}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">Unassigned</option>
      {showInactiveCurrent && (
        <option value={value} disabled>
          {(currentAssigneeName || 'Former staff member')} — Inactive
        </option>
      )}
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.fullName || 'Unnamed staff'}
        </option>
      ))}
    </Select>
  )
}
