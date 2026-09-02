import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/domain/PageHeader'

export default function CustomerDetail() {
  const { id } = useParams()
  return <PageHeader title={`Customer ${id}`} description="Customer detail" />
}
