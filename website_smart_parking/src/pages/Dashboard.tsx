import { Card } from '../components/common/Card'
import { useGateStatusQuery, useSlotsQuery, useVehiclesQuery, useLastDetectionQuery, useLastDetectionExitQuery } from '../hooks/useParkingData'
import { CarFront, ParkingCircle, DoorOpen, ShieldCheck, Camera } from 'lucide-react'
import { GATE_STATUS_LABEL } from '../constants/systemStatus'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiParkingRepository } from '../repositories/parkingRepository'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { data: slots = [] } = useSlotsQuery()
  const { data: vehicles = [] } = useVehiclesQuery()
  const { data: gates = [] } = useGateStatusQuery()
  const { data: lastDetectionEntry } = useLastDetectionQuery()
  const { data: lastDetectionExit } = useLastDetectionExitQuery()
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tổng quan hệ thống</h1>
      </div>

      {/* Phần trên: Trạng thái 3 ô đỗ xe */}
      <Card title="Trạng thái 3 ô đỗ xe">
        <div className="grid gap-4 sm:grid-cols-3">
          {slots.map((slot) => (
            <div key={slot.id} className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-4">
              <div
                className={`pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100 ${
                  slot.status === 'occupied'
                    ? 'bg-gradient-to-br from-red-600/40 via-red-500/15 to-transparent'
                    : 'bg-gradient-to-br from-green-600/35 via-emerald-500/15 to-transparent'
                }`}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ParkingCircle className="text-slate-200" size={18} />
                    <p className="text-base font-bold">{slot.label}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {slot.status === 'occupied' ? 'Đang có xe' : 'Trống'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {slot.status === 'occupied' ? 'Đang có xe gửi' : 'Sẵn sàng nhận xe'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="relative">
                    <span
                      className={`inline-flex h-3 w-3 rounded-full ${
                        slot.status === 'occupied' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    {slot.status === 'occupied' ? (
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-500/70" />
                    ) : null}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      slot.status === 'occupied' ? 'bg-red-500/15 text-red-200' : 'bg-green-500/15 text-green-200'
                    }`}
                  >
                    <CarFront size={14} />
                    {slot.status === 'occupied' ? 'OCCUPIED' : 'AVAILABLE'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Phần dưới: Trạng thái cổng */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cổng vào */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200 px-1">Cổng vào (ENTRY)</h2>
          <div className="grid gap-4">
            {gates.filter(g => g.gate === 'entry').map((gate) => (
              <div key={gate.gate} className="relative space-y-4">
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-700 bg-black aspect-video relative group">
                    <img 
                      src="http://localhost:8000/api/video_feed" 
                      alt="Camera Cổng Vào" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1590674852885-8c84bf3903d4?q=80&w=500&auto=format&fit=crop'
                      }}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                      Live
                    </div>
                  </div>

                  <div className="w-full xl:w-48 space-y-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                      <div className="flex items-center gap-2 mb-2 text-cyan-400">
                        <Camera size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ảnh biển số</span>
                      </div>
                      <div className="aspect-[3/1] w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
                        {lastDetectionEntry?.image ? (
                          <img 
                            src={`data:image/jpeg;base64,${lastDetectionEntry.image}`} 
                            alt="Biển số" 
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-600 italic">
                            No capture
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Biển số nhận diện:</p>
                        <p className="text-lg font-black tracking-wider text-white mt-0.5">
                          {lastDetectionEntry?.plate && lastDetectionEntry.plate !== "Chưa có" ? lastDetectionEntry.plate : 'Đang chờ...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600/20 text-cyan-400">
                        <DoorOpen size={18} />
                      </div>
                      <p className="font-bold">Trạng thái cổng</p>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      gate.status === 'idle' ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {gate.status === 'idle' ? 'Ready' : 'Active'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Cảm biến</span>
                      <p className="text-sm font-medium text-slate-200">{GATE_STATUS_LABEL[gate.status]}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Thông điệp</span>
                      <p className="text-sm text-slate-300 italic">"{gate.message}"</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loadingGate === gate.gate}
                    onClick={() => handleScan(gate.gate, gate.currentPlate ?? '')}
                    className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 transition-all hover:scale-[1.02] hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loadingGate === gate.gate ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    {loadingGate === gate.gate ? 'Đang thực hiện...' : 'Kích hoạt quét RFID'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cổng ra */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200 px-1">Cổng ra (EXIT)</h2>
          <div className="grid gap-4">
            {gates.filter(g => g.gate === 'exit').map((gate) => (
              <div key={gate.gate} className="relative space-y-4">
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-700 bg-black aspect-video relative group">
                    <img 
                      src="http://localhost:8000/api/video_feed_exit" 
                      alt="Camera Cổng Ra" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1590674852885-8c84bf3903d4?q=80&w=500&auto=format&fit=crop'
                      }}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                      Live
                    </div>
                  </div>

                  <div className="w-full xl:w-48 space-y-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                      <div className="flex items-center gap-2 mb-2 text-cyan-400">
                        <Camera size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Ảnh biển số</span>
                      </div>
                      <div className="aspect-[3/1] w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
                        {lastDetectionExit?.image ? (
                          <img 
                            src={`data:image/jpeg;base64,${lastDetectionExit.image}`} 
                            alt="Biển số" 
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-600 italic">
                            No capture
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Biển số nhận diện:</p>
                        <p className="text-lg font-black tracking-wider text-white mt-0.5">
                          {lastDetectionExit?.plate && lastDetectionExit.plate !== "Chưa có" ? lastDetectionExit.plate : 'Đang chờ...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
                        <DoorOpen size={18} />
                      </div>
                      <p className="font-bold">Trạng thái cổng</p>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      gate.status === 'idle' ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {gate.status === 'idle' ? 'Ready' : 'Active'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Cảm biến</span>
                      <p className="text-sm font-medium text-slate-200">{GATE_STATUS_LABEL[gate.status]}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Thông điệp</span>
                      <p className="text-sm text-slate-300 italic">"{gate.message}"</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loadingGate === gate.gate}
                    onClick={() => handleScan(gate.gate, gate.currentPlate ?? '')}
                    className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loadingGate === gate.gate ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    {loadingGate === gate.gate ? 'Đang thực hiện...' : 'Kích hoạt quét RFID'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
