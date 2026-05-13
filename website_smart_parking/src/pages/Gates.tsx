import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '../components/common/Card'
import { useGateStatusQuery } from '../hooks/useParkingData'
import { apiParkingRepository } from '../repositories/parkingRepository'
import { GATE_STATUS_LABEL } from '../constants/systemStatus'

export default function Gates() {
  const queryClient = useQueryClient()
  const { data: gates = [] } = useGateStatusQuery()
  const [loadingGate, setLoadingGate] = useState<'entry' | 'exit' | null>(null)

  const handleScan = async (gate: 'entry' | 'exit', plateNumber: string) => {
    setLoadingGate(gate)
    await apiParkingRepository.scanRfid(gate, plateNumber)
    await queryClient.invalidateQueries({ queryKey: ['gates'] })
    await queryClient.invalidateQueries({ queryKey: ['history'] })
    setLoadingGate(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cổng vào và cổng ra</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {gates.map((gate) => (
          <Card key={gate.gate} title={gate.gate === 'entry' ? 'Cổng vào' : 'Cổng ra'}>
            <p className="mb-2 text-sm text-slate-300">Trạng thái: {GATE_STATUS_LABEL[gate.status]}</p>
            <p className="mb-3 text-sm">{gate.message}</p>
            <button
              type="button"
              disabled={loadingGate === gate.gate}
              onClick={() => handleScan(gate.gate, gate.currentPlate ?? '')}
              className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingGate === gate.gate ? 'Đang quét RFID...' : 'Quét RFID'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}
