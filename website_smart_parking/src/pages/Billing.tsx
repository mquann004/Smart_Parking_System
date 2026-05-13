import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card } from '../components/common/Card'
import { apiParkingRepository } from '../repositories/parkingRepository'
import { useVehiclesQuery } from '../hooks/useParkingData'
import { formatVnd } from '../utils/currency'
import { toDateTime } from '../utils/time'
import { useParkingStore } from '../store/parkingStore'

export default function Billing() {
  const { data: vehicles = [] } = useVehiclesQuery()
  const [selectedPlate, setSelectedPlate] = useState('')
  const latestSession = useParkingStore((state) => state.latestSession)
  const setLatestSession = useParkingStore((state) => state.setLatestSession)

  const checkoutAt = useMemo(() => new Date().toISOString(), [])
  const calculateMutation = useMutation({
    mutationFn: () => apiParkingRepository.calculateFee(selectedPlate, new Date().toISOString()),
    onSuccess: (session) => setLatestSession(session),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tính phí gửi xe theo thời gian</h1>
      <Card title="Chọn xe cần tính phí">
        <div className="flex flex-col gap-2 md:flex-row">
          <select
            value={selectedPlate}
            onChange={(event) => setSelectedPlate(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">-- Chọn xe theo ô đỗ --</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.plateNumber}>
                Xe {vehicle.type === 'car' ? 'Ô tô' : 'Xe máy'} - {vehicle.slotId}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedPlate || calculateMutation.isPending}
            onClick={() => calculateMutation.mutate()}
            className="rounded-md bg-amber-500 px-3 py-2 font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {calculateMutation.isPending ? 'Đang tính...' : 'Tính tiền'}
          </button>
        </div>
      </Card>
      <Card title="Kết quả phiên gửi xe">
        {latestSession ? (
          <div className="space-y-1 text-sm">
            <p>ID Giao dịch: {latestSession.sessionId.split('-')[0]}</p>
            <p>Giờ vào: {toDateTime(latestSession.checkInAt)}</p>
            <p>Giờ ra: {toDateTime(latestSession.checkOutAt)}</p>
            <p>Tổng phút (làm tròn): {latestSession.durationMinutes} phút</p>
            <p className="text-lg font-bold text-green-400">Tổng phí: {formatVnd(latestSession.totalFee)}</p>
            <p className="text-slate-400">
              Công thức: Ceil(Tổng phút / 30) x 30 / 60 x 5.000đ
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Chưa có phiên tính phí. Hãy chọn xe và bấm Tính tiền.</p>
        )}
      </Card>
      <p className="text-xs text-slate-500">Thời điểm hiện tại để mô phỏng checkout: {toDateTime(checkoutAt)}</p>
    </div>
  )
}
