  import { useMemo, useState } from 'react'
import { Card } from '../components/common/Card'
import { useVehiclesQuery } from '../hooks/useParkingData'
import { timeAgoStrict, toDateTime } from '../utils/time'

export default function Vehicles() {
  const { data: vehicles = [] } = useVehiclesQuery()
  const [typeFilter, setTypeFilter] = useState<'all' | 'car' | 'motorbike'>('all')
  const filtered = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const matchedType = typeFilter === 'all' || vehicle.type === typeFilter
        return matchedType
      }),
    [vehicles, typeFilter],
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Current Occupancy</h1>
      <Card title="Filters">
        <div className="grid gap-2 md:grid-cols-2">

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as 'all' | 'car' | 'motorbike')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="all">All Vehicle Types</option>
            <option value="car">Car</option>
            <option value="motorbike">Motorbike</option>
          </select>
        </div>
      </Card>
      <Card title="Parked Vehicles">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr>

                <th className="p-2">Type</th>
                <th className="p-2">Slot</th>
                <th className="p-2">Entry Time</th>
                <th className="p-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => (
                <tr key={vehicle.id} className="border-t border-slate-700">

                  <td className="p-2">{vehicle.type === 'car' ? 'Car' : 'Motorbike'}</td>
                  <td className="p-2">{vehicle.slotId}</td>
                  <td className="p-2">{toDateTime(vehicle.checkInAt)}</td>
                  <td className="p-2">{timeAgoStrict(vehicle.checkInAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
