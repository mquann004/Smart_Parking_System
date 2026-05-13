import { Card } from '../components/common/Card'
import { useHistoryQuery } from '../hooks/useParkingData'
import { toDateTime } from '../utils/time'

export default function History() {
  const { data: history = [] } = useHistoryQuery()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lịch sử ra vào</h1>
      <Card title="Log sự kiện">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr>
                <th className="p-2">Thời gian</th>
                <th className="p-2">Cổng</th>

                <th className="p-2">Sự kiện</th>
                <th className="p-2">Kết quả</th>
                <th className="p-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {history.map((event) => (
                <tr key={event.id} className="border-t border-slate-700">
                  <td className="p-2">{toDateTime(event.timestamp)}</td>
                  <td className="p-2">{event.gate === 'entry' ? 'Vào' : 'Ra'}</td>

                  <td className="p-2">{event.eventType}</td>
                  <td className="p-2">{event.success ? 'Thành công' : 'Thất bại'}</td>
                  <td className="p-2">{event.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
