import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { RequireAuth } from '@/layouts/RequireAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ProductionBoard from '@/pages/ProductionBoard'
import OrdersList from '@/pages/OrdersList'
import NewOrderForm from '@/pages/NewOrderForm'
import EditOrderForm from '@/pages/EditOrderForm'
import OrderDetail from '@/pages/OrderDetail'
import CustomersList from '@/pages/CustomersList'
import CustomerDetail from '@/pages/CustomerDetail'
import PublicOrderLinks from '@/pages/PublicOrderLinks'
import PublicOrderForm from '@/pages/PublicOrderForm'
import SettingsIndex from '@/pages/settings/SettingsIndex'
import SettingsGarments from '@/pages/settings/SettingsGarments'
import SettingsServices from '@/pages/settings/SettingsServices'
import SettingsStatuses from '@/pages/settings/SettingsStatuses'
import SettingsMockups from '@/pages/settings/SettingsMockups'
import SettingsBusiness from '@/pages/settings/SettingsBusiness'
import ChangePassword from '@/pages/ChangePassword'
import NotFound from '@/pages/NotFound'

// Phase 5 hardening: User Management is the one route the large majority
// of signed-in staff never open (it's admin-only), so it's the one
// "obvious opportunity" named for route-level code-splitting — split out
// of the main chunk rather than eagerly bundled for every staff sign-in.
const SettingsUsers = lazy(() => import('@/pages/settings/SettingsUsers'))

// Phase 5 hardening: a single app-root boundary. Without this, an uncaught
// render error anywhere in the tree (a bad API shape, a null-reference bug)
// unmounts the entire app to a blank white screen with no recovery path.
// This is intentionally the only route-level boundary — MockupStudio's
// existing one stays scoped to the Fabric canvas specifically (its failure
// mode, a lazy-chunk load failure, is unrelated to a general render crash),
// and wrapping every individual route would just be defensive clutter for
// failure modes that don't occur per-route in this app.
function AppCrashFallback(retry: () => void) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-app-bg px-4 text-center">
      <p className="text-sm font-medium text-zinc-800">Something went wrong.</p>
      <p className="max-w-sm text-sm text-zinc-500">
        The app hit an unexpected error. Try again, or reload the page if the problem continues.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={retry}>
          Try Again
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary fallback={AppCrashFallback}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public Customer Order Link — intentionally outside RequireAuth
              and AppShell, the same way /login is: no session, no sidebar.
              This is the one route in the app a fully anonymous visitor
              can reach. */}
          <Route path="/order-request/:token" element={<PublicOrderForm />} />
          <Route element={<RequireAuth />}>
            <Route path="/change-password" element={<ChangePassword />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/production" element={<ProductionBoard />} />
              <Route path="/orders" element={<OrdersList />} />
              <Route path="/orders/links" element={<PublicOrderLinks />} />
              <Route path="/orders/new" element={<NewOrderForm />} />
              <Route path="/orders/:id/edit" element={<EditOrderForm />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/customers" element={<CustomersList />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/settings" element={<SettingsIndex />} />
              <Route path="/settings/garments" element={<SettingsGarments />} />
              <Route path="/settings/services" element={<SettingsServices />} />
              <Route path="/settings/statuses" element={<SettingsStatuses />} />
              <Route path="/settings/mockups" element={<SettingsMockups />} />
              <Route path="/settings/business" element={<SettingsBusiness />} />
              <Route
                path="/settings/users"
                element={
                  <Suspense fallback={<p className="p-4 text-sm text-zinc-400">Loading...</p>}>
                    <SettingsUsers />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  )
}
