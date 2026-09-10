import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Plus, ShieldAlert, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { FormField, Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/toast-context'
import { useProfile } from '@/hooks/useProfile'
import {
  useCreateUser,
  useResetUserPassword,
  useSetUserActive,
  useSetUserRole,
  useUpdateUserName,
  useUsers,
} from '@/hooks/useAdminUsers'
import type { AdminUserRow } from '@/api/adminUsers'
import { staffErrorMessage } from '@/utils/errorMessage'

type DialogState = { mode: 'create' } | { mode: 'edit'; user: AdminUserRow } | null

export default function SettingsUsers() {
  const navigate = useNavigate()
  const { data: currentProfile } = useProfile()
  const { data: users = [], isLoading } = useUsers()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<AdminUserRow | null>(null)
  const [pendingReset, setPendingReset] = useState<AdminUserRow | null>(null)

  const setActive = useSetUserActive()
  const resetPassword = useResetUserPassword()

  const isAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'owner'

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (u.fullName ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  })

  if (!isAdmin) {
    return (
      <div>
        <button
          onClick={() => navigate('/settings')}
          className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft size={14} /> Back to Settings
        </button>
        <EmptyState
          icon={ShieldAlert}
          title="Not authorized"
          description="User Management is restricted to administrators."
        />
      </div>
    )
  }

  const handleToggleActive = async (user: AdminUserRow) => {
    if (user.isActive) {
      setPendingDeactivate(user)
      return
    }
    try {
      await setActive.mutateAsync({ id: user.id, isActive: true })
      showToast(`${user.fullName ?? 'User'} reactivated`, 'success')
    } catch (err) {
      showToast(staffErrorMessage(err, "Couldn't update this user — try again"), 'info')
    }
  }

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) return
    try {
      await setActive.mutateAsync({ id: pendingDeactivate.id, isActive: false })
      showToast(`${pendingDeactivate.fullName ?? 'User'} deactivated`, 'success')
    } catch (err) {
      showToast(staffErrorMessage(err, "Couldn't deactivate this user — try again"), 'info')
    } finally {
      setPendingDeactivate(null)
    }
  }

  const confirmReset = async () => {
    if (!pendingReset) return
    try {
      await resetPassword.mutateAsync(pendingReset.id)
      showToast(`Password reset — ${pendingReset.fullName ?? 'this user'} must set a new password at next sign-in.`, 'success')
    } catch (err) {
      showToast(staffErrorMessage(err, "Couldn't reset this user's password — try again"), 'info')
    } finally {
      setPendingReset(null)
    }
  }

  return (
    <div>
      <button
        onClick={() => navigate('/settings')}
        className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft size={14} /> Back to Settings
      </button>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="User Management" description="Brand Fanatix staff accounts, roles, and access" />
        <Button type="button" variant="primary" onClick={() => setDialog({ mode: 'create' })}>
          <Plus size={14} /> Add User
        </Button>
      </div>

      <div className="mb-3 max-w-xs">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={UserCog} title="No users found" description="Try a different search, or add a new user." />
          </div>
        ) : (
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-800">{user.fullName || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{user.email || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={user.role === 'staff' ? 'border-zinc-200 bg-zinc-50 text-zinc-600' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}>
                        {user.role === 'owner' ? 'Admin' : user.role === 'admin' ? 'Admin' : 'Staff'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={user.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDialog({ mode: 'edit', user })}>
                          Edit
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleToggleActive(user)}>
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setPendingReset(user)}>
                          <KeyRound size={12} /> Reset Password
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        )}
      </Card>

      {dialog && (
        <UserFormDialog
          dialog={dialog}
          currentUserId={currentProfile?.id}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeactivate}
        title="Deactivate this user?"
        description={`${pendingDeactivate?.fullName ?? 'This user'} will no longer be able to sign in or be assigned new orders. Historical records are unaffected.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={confirmDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      />

      <ConfirmDialog
        open={!!pendingReset}
        title="Reset this user's password?"
        description={`${pendingReset?.fullName ?? 'This user'} will need to sign in with the onboarding temporary password and choose a new one before using the CRM again.`}
        confirmLabel="Reset Password"
        danger
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />
    </div>
  )
}

function UserFormDialog({
  dialog,
  currentUserId,
  onClose,
}: {
  dialog: { mode: 'create' } | { mode: 'edit'; user: AdminUserRow }
  currentUserId: string | undefined
  onClose: () => void
}) {
  const { showToast } = useToast()
  const createUser = useCreateUser()
  const updateUserName = useUpdateUserName()
  const setRole = useSetUserRole()

  const isEdit = dialog.mode === 'edit'
  const existing = isEdit ? dialog.user : null

  const [fullName, setFullName] = useState(existing?.fullName ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [role, setRoleValue] = useState<'admin' | 'staff'>(existing?.role === 'admin' || existing?.role === 'owner' ? 'admin' : 'staff')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isSelf = isEdit && existing?.id === currentUserId

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || (!isEdit && !email.trim())) {
      setError('Name and email are required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      if (isEdit && existing) {
        if (fullName.trim() !== existing.fullName) {
          await updateUserName.mutateAsync({ id: existing.id, fullName: fullName.trim() })
        }
        if (role !== existing.role && !isSelf) {
          await setRole.mutateAsync({ id: existing.id, role })
        }
        showToast('User updated', 'success')
      } else {
        await createUser.mutateAsync({ fullName: fullName.trim(), email: email.trim(), role })
        showToast('User created — they can sign in with the onboarding temporary password.', 'success')
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit User' : 'Add User'}
        className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h3 className="mb-4 text-base font-semibold text-zinc-900">{isEdit ? 'Edit User' : 'Add User'}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Full Name" htmlFor="user-full-name" required>
            <Input id="user-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Email" htmlFor="user-email" required={!isEdit}>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
            />
          </FormField>
          <FormField label="Role" htmlFor="user-role" hint={isSelf ? "You can't change your own role." : undefined}>
            <Select
              id="user-role"
              value={role}
              disabled={isSelf}
              onChange={(e) => setRoleValue(e.target.value as 'admin' | 'staff')}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>

          {!isEdit && (
            <p className="rounded-md bg-zinc-50 px-2.5 py-2 text-xs text-zinc-500">
              This account will sign in with the onboarding temporary password and be required to set a new one
              immediately.
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
