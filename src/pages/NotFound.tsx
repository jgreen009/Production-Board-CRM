import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-sm font-medium text-zinc-400">404</p>
      <h1 className="text-xl font-semibold text-zinc-900">Page not found</h1>
      <p className="text-sm text-zinc-500">
        That page doesn&apos;t exist. Check the URL or head back to the dashboard.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" className="mt-2">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}
