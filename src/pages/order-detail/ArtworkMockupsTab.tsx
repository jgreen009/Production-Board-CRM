import { FileIcon, Image as ImageIcon } from 'lucide-react'
import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { GarmentMockup } from '@/components/domain/GarmentMockup'
import { getPrintPositionConfig } from '@/data/printPositions'
import { formatDateShort } from '@/utils/date'

export function ArtworkMockupsTab({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Original Artwork</h3>
        </CardHeader>
        <CardBody>
          {order.artwork.length === 0 ? (
            <EmptyState icon={ImageIcon} title="No artwork files uploaded" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {order.artwork.map((file) => (
                <div key={file.id} className="rounded-lg border border-zinc-200 p-2">
                  <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-md bg-zinc-50">
                    {file.previewUrl ? (
                      <img src={file.previewUrl} alt={file.fileName} className="h-full w-full object-cover" />
                    ) : (
                      <FileIcon size={20} className="text-zinc-300" />
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-zinc-700">{file.fileName}</p>
                  <p className="text-xs text-zinc-400">{file.fileType} · {file.sizeKb} KB</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Mockups</h3>
        </CardHeader>
        <CardBody>
          {order.printSpecs.length === 0 ? (
            <EmptyState icon={ImageIcon} title="No mockups saved for this order" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {order.printSpecs.map((spec) => {
                const artwork = order.artwork.find((a) => a.id === spec.artworkId)
                const garmentType = spec.garmentType ?? order.garments[0]?.type
                const garmentColour = spec.garmentColour || order.garments[0]?.colour || ''
                if (!garmentType) return null
                return (
                  <div key={spec.id} className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                    <GarmentMockup
                      garmentType={garmentType}
                      colour={garmentColour}
                      view={getPrintPositionConfig(spec.position).view}
                      position={spec.position}
                      artworkUrl={artwork?.previewUrl}
                      widthMm={spec.widthMm}
                      heightMm={spec.heightMm}
                      offset={{ x: spec.offsetX ?? 0, y: spec.offsetY ?? 0 }}
                      onOffsetChange={() => {}}
                      size={110}
                    />
                    <p className="text-center text-xs font-medium text-zinc-600">
                      {garmentColour} {garmentType} — {spec.position}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">File Metadata</h3>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          {order.artwork.length === 0 ? (
            <p className="p-4 text-sm text-zinc-400">No files to show.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="px-4 py-2 font-medium">File</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Uploaded</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                </tr>
              </thead>
              <tbody>
                {order.artwork.map((file) => (
                  <tr key={file.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-zinc-700">{file.fileName}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{file.fileType}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{formatDateShort(file.uploadedAt)}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{file.sizeKb} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
