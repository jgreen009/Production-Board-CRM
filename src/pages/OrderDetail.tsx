import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/domain/PageHeader'

export default function OrderDetail() {
  const { id } = useParams()
  return <PageHeader title={`Order ${id}`} description="Order detail" />
}
