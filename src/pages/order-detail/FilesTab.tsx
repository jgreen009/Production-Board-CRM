import { Download, Eye } from 'lucide-react'
import type { Order } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileIcon } from 'lucide-react'
import { formatDateShort } from '@/utils/date'

export function FilesTab({ order }: { order: Order }) {
  if (order.artwork.length === 0) {
    return <EmptyState icon={FileIcon} title="No files uploaded for this order" />
  }

  return (
    <Card>
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs text-zinc-400">
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Uploaded</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {order.artwork.map((file) => (
              <tr key={file.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-700">{file.fileName}</td>
                <td className="px-4 py-2.5 text-zinc-600">{file.fileType}</td>
                <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(file.uploadedAt)}</td>
                <td className="px-4 py-2.5 text-zinc-500">{file.sizeKb} KB</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="View">
                      <Eye size={14} />
                    </button>
                    <button className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Download">
                      <Download size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  )
}
