import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/domain/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/toast-context'
import type { ToastContextValue } from '@/components/ui/toast-context'
import { useBusinessSettings, useUpdateBusinessSettings } from '@/hooks/useSettings'
import type { BusinessSettings } from '@/api/settings'
import { staffErrorMessage } from '@/utils/errorMessage'

export default function SettingsBusiness() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data: settings, isLoading } = useBusinessSettings()

  if (isLoading || !settings) {
    return <p className="p-4 text-sm text-zinc-400">Loading...</p>
  }

  return <SettingsBusinessForm key={settings.id} settings={settings} onBack={() => navigate('/settings')} showToast={showToast} />
}

// Keyed by settings.id in the parent so this remounts (and re-initializes
// its draft state directly from the loaded row) if the underlying data
// ever changes out from under it — same pattern as CustomerDetail's notes
// card (Milestone 3).
function SettingsBusinessForm({
  settings,
  onBack,
  showToast,
}: {
  settings: BusinessSettings
  onBack: () => void
  showToast: ToastContextValue['showToast']
}) {
  const updateSettings = useUpdateBusinessSettings()
  const [form, setForm] = useState({
    businessName: settings.businessName,
    businessEmail: settings.businessEmail,
    businessPhone: settings.businessPhone,
    standardTurnaroundMinDays: settings.standardTurnaroundMinDays,
    standardTurnaroundMaxDays: settings.standardTurnaroundMaxDays,
    orderNumberPrefix: settings.orderNumberPrefix,
  })

  const handleSave = () => {
    updateSettings.mutate(
      { id: settings.id, input: form },
      {
        onSuccess: () => showToast('Business settings saved.', 'success'),
        onError: (err) => showToast(staffErrorMessage(err, 'Failed to save'), 'info'),
      },
    )
  }

  return (
    <div>
      <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft size={14} /> Back to Settings
      </button>
      <PageHeader title="Business Settings" description="Business details and turnaround defaults" />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Business Name" htmlFor="businessName">
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </FormField>
            <FormField label="Order Number Prefix" htmlFor="orderNumberPrefix">
              <Input
                id="orderNumberPrefix"
                value={form.orderNumberPrefix}
                onChange={(e) => setForm({ ...form, orderNumberPrefix: e.target.value })}
              />
            </FormField>
            <FormField label="Business Email" htmlFor="businessEmail">
              <Input
                id="businessEmail"
                type="email"
                value={form.businessEmail}
                onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
              />
            </FormField>
            <FormField label="Business Phone" htmlFor="businessPhone">
              <Input
                id="businessPhone"
                value={form.businessPhone}
                onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
              />
            </FormField>
            <FormField label="Standard Turnaround — Min Days" htmlFor="minDays">
              <Input
                id="minDays"
                type="number"
                min={1}
                value={form.standardTurnaroundMinDays}
                onChange={(e) => setForm({ ...form, standardTurnaroundMinDays: Number(e.target.value) || 1 })}
              />
            </FormField>
            <FormField label="Standard Turnaround — Max Days" htmlFor="maxDays">
              <Input
                id="maxDays"
                type="number"
                min={1}
                value={form.standardTurnaroundMaxDays}
                onChange={(e) => setForm({ ...form, standardTurnaroundMaxDays: Number(e.target.value) || 1 })}
              />
            </FormField>
          </div>

          <div>
            <Button variant="primary" size="sm" disabled={updateSettings.isPending} onClick={handleSave}>
              {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
