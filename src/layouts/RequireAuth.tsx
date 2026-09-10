import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { useProfile } from '@/hooks/useProfile'
import { signOut } from '@/api/auth'

function CenteredMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">{children}</div>
}

// Phase 4 Milestone 1: session existence alone is no longer enough to
// enter the app. Order of checks matters — each one only makes sense once
// the previous has passed:
//   1. no session -> /login
//   2. session but the profile hasn't loaded yet -> wait (never flash the
//      app before we know active/must-change-password status)
//   3. profile failed to load at all -> treat as unauthenticated (fail
//      closed, not open)
//   4. profile.isActive is false -> sign out immediately (real
//      enforcement also happens at the Auth layer via banned_until, but a
//      currently-valid session token could otherwise keep working until
//      it naturally expires — this closes that window)
//   5. profile.mustChangePassword -> redirect to /change-password, and
//      nowhere else is reachable until it's cleared. The reverse
//      (mustChangePassword is false but already on /change-password) also
//      redirects away, so neither state can get stuck in a loop.
export function RequireAuth() {
  const { session, loading: sessionLoading } = useSession()
  const location = useLocation()
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile()

  const isInactive = !!profile && !profile.isActive
  useEffect(() => {
    if (isInactive) {
      void signOut()
    }
  }, [isInactive])

  if (sessionLoading) {
    return <CenteredMessage>Loading...</CenteredMessage>
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (profileLoading) {
    return <CenteredMessage>Loading...</CenteredMessage>
  }

  if (profileError || !profile) {
    return <Navigate to="/login" replace />
  }

  if (isInactive) {
    // signOut() is in flight (see effect above) — once it resolves,
    // useSession's session becomes null and this component re-renders
    // into the plain "no session" branch above.
    return <CenteredMessage>This account has been deactivated. Signing out...</CenteredMessage>
  }

  if (profile.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (!profile.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
