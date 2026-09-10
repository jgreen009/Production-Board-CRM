import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { clearMustChangePassword, updateOwnPassword } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'

const MIN_LENGTH = 8
// SHA-256 of the onboarding temporary password — deliberately not the
// plaintext itself. The actual string exists only in the admin-users Edge
// Function's server-side environment; this hash lets the client reject it
// as a new-password choice without ever holding the plaintext.
const TEMPORARY_PASSWORD_SHA256 = 'dcfff244cffa15a44bb0c4f11b1d41597ba1f5f8bca469aff7f368c6b0a92e9'

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function validate(password: string, confirm: string): Promise<string | null> {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`
  if ((await sha256Hex(password.trim().toLowerCase())) === TEMPORARY_PASSWORD_SHA256) {
    return 'Choose a different password from the temporary one you signed in with.'
  }
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

// Outside the normal AppShell (no sidebar) — reached only via RequireAuth's
// redirect while profile.must_change_password is true, and unreachable
// once it's cleared (RequireAuth redirects away from here in that case).
export default function ChangePassword() {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const validationError = await validate(password, confirm)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await updateOwnPassword(password)
      // Only clear the flag once the password change has actually
      // succeeded — never before.
      await clearMustChangePassword()
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-white">
            <KeyRound size={18} />
          </span>
          <h1 className="text-lg font-semibold text-zinc-900">Change Your Password</h1>
          <p className="text-center text-sm text-zinc-500">
            You&rsquo;re signed in with a temporary password. Choose a new one to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="New Password" htmlFor="new-password" required>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="Confirm Password" htmlFor="confirm-password" required>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" variant="primary" disabled={submitting} className="justify-center">
            {submitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
