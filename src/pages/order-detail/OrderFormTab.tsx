import type { Order } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ADULT_SIZES, YOUTH_SIZES } from '@/types'
import { garmentTotal } from '@/utils/quantity'
import { formatDate } from '@/utils/date'

export function OrderFormTab({ order }: { order: Order }) {
  const adultGarments = order.garments.filter((g) => g.sizing === 'Adult')
  const youthGarments = order.garments.filter((g) => g.sizing === 'Youth')
  const subTotal = order.garments.reduce((sum, g) => sum + garmentTotal(g), 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Header</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <ReadField label="Date" value={formatDate(order.createdAt)} />
          <ReadField label="Pick Up / Delivery" value={order.deliveryMethod} />
          <ReadField label="Name / Job" value={order.jobName} />
          <ReadField label="Phone" value={order.phone} />
          <ReadField label="Email" value={order.email} />
          <ReadField label="Date Due" value={formatDate(order.dueDate)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Services Required</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {order.services.map((s) => (
            <span key={s.name} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
              ✓ {s.name}
            </span>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Requirements</h3>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <ReadField label="Supply Garments" value={order.suppliesGarments ? 'Yes' : 'No'} />
          <ReadField label="Graphic Design Services" value={order.graphicDesignServices ? 'Yes' : 'No'} />
          <ReadField label="Specialised Application" value={order.specialisedApplication ? 'Yes' : 'No'} />
          <ReadField label="Rush Fee" value={order.rushFee ? 'Yes' : 'No'} />
          {order.specialisedApplication && order.specialisedApplicationDetails && (
            <div className="col-span-2 sm:col-span-4">
              <ReadField label="Application Details" value={order.specialisedApplicationDetails} />
            </div>
          )}
        </CardBody>
      </Card>

      {adultGarments.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-800">Garment Table — Adult</h3>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400">
                  <th className="px-3 py-2 font-medium">Garment</th>
                  <th className="px-3 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">Colour</th>
                  {ADULT_SIZES.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-medium">{s}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {adultGarments.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-zinc-700">{g.type}</td>
                    <td className="px-3 py-2 text-zinc-600">{g.brand}</td>
                    <td className="px-3 py-2 text-zinc-600">{g.colour}</td>
                    {ADULT_SIZES.map((s) => (
                      <td key={s} className="px-2 py-2 text-center text-zinc-600">{g.adultQuantities?.[s] || '-'}</td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-zinc-800">{garmentTotal(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {youthGarments.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-800">Garment Table — Youth</h3>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400">
                  <th className="px-3 py-2 font-medium">Garment</th>
                  <th className="px-3 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">Colour</th>
                  {YOUTH_SIZES.map((s) => (
                    <th key={s} className="px-2 py-2 text-center font-medium">{s}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {youthGarments.map((g) => (
                  <tr key={g.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-zinc-700">{g.type}</td>
                    <td className="px-3 py-2 text-zinc-600">{g.brand}</td>
                    <td className="px-3 py-2 text-zinc-600">{g.colour}</td>
                    {YOUTH_SIZES.map((s) => (
                      <td key={s} className="px-2 py-2 text-center text-zinc-600">{g.youthQuantities?.[s] || '-'}</td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-zinc-800">{garmentTotal(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-600">Sub Total</span>
          <span className="text-lg font-semibold text-zinc-900">{subTotal}</span>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Print Colour / Print Measurements</h3>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Colour</th>
                <th className="px-3 py-2 font-medium">Width (mm)</th>
                <th className="px-3 py-2 font-medium">Height (mm)</th>
              </tr>
            </thead>
            <tbody>
              {order.printDetails.map((pd) => (
                <tr key={pd.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-3 py-2 text-zinc-700">{pd.position}</td>
                  <td className="px-3 py-2 text-zinc-600">{pd.colour}</td>
                  <td className="px-3 py-2 text-zinc-600">{pd.widthMm}</td>
                  <td className="px-3 py-2 text-zinc-600">{pd.heightMm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-zinc-800">Notes</h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-zinc-600">{order.notes || 'No notes recorded on the order form.'}</p>
        </CardBody>
      </Card>

      <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-400">
        100% deposit required before manufacturing commences. Quotes, invoices, and screens are valid for
        3 weeks. 25 units is the minimum order for screen printing (special pricing available under
        minimum). Standard turnaround time is 5–10 working days.
      </p>

      <div className="flex items-center gap-2.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border ${
            order.staffCompleted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white'
          }`}
        >
          {order.staffCompleted && '✓'}
        </span>
        <span className="font-medium text-zinc-600">
          Section for staff — {order.staffCompleted ? 'Completed' : 'Not completed'}
        </span>
      </div>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="font-medium text-zinc-700">{value}</p>
    </div>
  )
}
