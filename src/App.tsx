import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/layouts/AppShell'
import { RequireAuth } from '@/layouts/RequireAuth'
import { ToastProvider } from '@/components/ui/Toast'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import ProductionBoard from '@/pages/ProductionBoard'
import OrdersList from '@/pages/OrdersList'
import NewOrderForm from '@/pages/NewOrderForm'
import EditOrderForm from '@/pages/EditOrderForm'
import OrderDetail from '@/pages/OrderDetail'
import CustomersList from '@/pages/CustomersList'
import CustomerDetail from '@/pages/CustomerDetail'
import SettingsIndex from '@/pages/settings/SettingsIndex'
import SettingsGarments from '@/pages/settings/SettingsGarments'
import SettingsServices from '@/pages/settings/SettingsServices'
import SettingsStatuses from '@/pages/settings/SettingsStatuses'
import SettingsMockups from '@/pages/settings/SettingsMockups'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/production" element={<ProductionBoard />} />
            <Route path="/orders" element={<OrdersList />} />
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
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </ToastProvider>
  )
}
