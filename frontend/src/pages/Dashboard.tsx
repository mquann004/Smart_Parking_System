import { Card } from '../components/common/Card'
import { useGateStatusQuery, useSlotsQuery, useVehiclesQuery, useLastDetectionQuery, useLastDetectionExitQuery, useLastRfidQuery } from '../hooks/useParkingData'
import { CarFront, ParkingCircle, DoorOpen, ShieldCheck, Camera, Lock, Unlock, Clock } from 'lucide-react'
import { GATE_STATUS_LABEL } from '../constants/systemStatus'
import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiParkingRepository } from '../repositories/parkingRepository'
import { toDateTime } from '../utils/time'

// RFID Display Component
const RfidDisplay = ({ gate }: { gate: 'entry' | 'exit' }) => {
  const { data: lastRfid } = useLastRfidQuery(gate)
  const [displayUid, setDisplayUid] = useState<string | null>(null)
  const lastTimestampRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastRfid?.uid && lastRfid.timestamp !== lastTimestampRef.current) {
      setDisplayUid(lastRfid.uid)
      lastTimestampRef.current = lastRfid.timestamp
      
      const timer = setTimeout(() => {
        setDisplayUid(null)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [lastRfid])

  return (
    <div className="mt-6 h-[48px] w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center relative shadow-inner">
      <div className={`absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 transition-opacity duration-500 ${displayUid ? 'opacity-100' : 'opacity-0'}`} />
      {displayUid ? (
        <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <ShieldCheck className="text-blue-400" size={18} />
          <span className="font-mono font-bold text-blue-100 tracking-widest">{displayUid}</span>
        </div>
      ) : (
        <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest opacity-50">Waiting for RFID scan...</span>
      )}
    </div>
  )
}

// Confirmation Modal Component
const ConfirmationModal = ({ 
  gate, 
  plate, 
  expectedPlate,
  errorMsg,
  entryTime,
  durationMinutes,
  totalFee,
  onConfirm, 
  onReject,
  isLoading 
}: { 
  gate: 'entry' | 'exit', 
  plate: string, 
  expectedPlate?: string | null,
  errorMsg?: string | null,
  entryTime?: string | null,
  durationMinutes?: number | null,
  totalFee?: number | null,
  onConfirm: (corrected?: string) => void, 
  onReject: () => void,
  isLoading: boolean
}) => {
  const [correctedPlate, setCorrectedPlate] = useState(plate)
  const isMismatch = gate === 'exit' && expectedPlate && correctedPlate !== expectedPlate
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center gap-3 text-white">
            <Camera size={20} />
            <h3 className="text-lg font-bold">Plate Confirmation - {gate === 'entry' ? 'ENTRY' : 'EXIT'}</h3>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">license detect</label>
            <div className="relative">
              <input 
                type="text" 
                value={correctedPlate}
                onChange={(e) => setCorrectedPlate(e.target.value.toUpperCase())}
                className={`w-full rounded-xl border-2 bg-slate-950 px-4 py-3 text-2xl font-black tracking-widest text-white focus:outline-none transition-colors ${
                  isMismatch ? 'border-red-500/50 focus:border-red-500' : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <ShieldCheck size={20} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">Please correct the plate if the detection is inaccurate.</p>
          </div>

          {expectedPlate && (
            <div className={`rounded-xl border p-4 transition-colors duration-300 ${
              isMismatch ? 'border-red-500/30 bg-red-500/10' : 'border-blue-500/30 bg-blue-500/10'
            }`}>
              <div className={`flex items-center gap-2 mb-1 ${isMismatch ? 'text-red-400' : 'text-blue-400'}`}>
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {isMismatch ? 'Warning: Plate Mismatch!' : 'Cross-check with Entry Plate'}
                </span>
              </div>
              <p className={`text-xl font-black tracking-widest ${isMismatch ? 'text-red-100' : 'text-blue-100'}`}>{expectedPlate}</p>
              <p className={`text-[10px] mt-1 ${isMismatch ? 'text-red-400/70 font-bold' : 'text-blue-400/70'}`}>
                {isMismatch 
                   ? 'System blocked gate opening due to incorrect plate.' 
                   : 'Plate matched. You can allow the vehicle through.'}
              </p>
            </div>
          )}

          {gate === 'exit' && !isMismatch && totalFee !== undefined && totalFee !== null && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4 animate-in zoom-in duration-500">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Clock size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Parking Details</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-500 uppercase">Billing System</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <p className="text-slate-500">Entry Time:</p>
                  <p className="font-bold text-slate-200">{entryTime ? toDateTime(entryTime) : '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Total Duration:</p>
                  <p className="font-bold text-slate-200">{durationMinutes} min</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-emerald-500/20 p-3">
                <span className="text-sm font-bold text-emerald-400 uppercase">Grand Total:</span>
                <span className="text-2xl font-black text-white">${totalFee.toLocaleString('en-US')}</span>
              </div>
            </div>
          )}

          {errorMsg && !isMismatch && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-pulse">
              <p className="text-sm font-bold text-red-400">{errorMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onReject}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50"
            >
              <Camera size={16} />
              Quét lại
            </button>
            <button
              onClick={() => onConfirm(correctedPlate)}
              disabled={isLoading || isMismatch}
              className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-700 disabled:shadow-none ${
                isMismatch ? 'bg-slate-700' : 'bg-emerald-600 shadow-emerald-900/40 hover:bg-emerald-500'
              }`}
            >
              {isLoading ? 'Processing...' : gate === 'exit' ? 'Pay & Open Gate' : 'Confirm & Open Gate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const { data: slots = [] } = useSlotsQuery()
  const { data: vehicles = [] } = useVehiclesQuery()
  const { data: gates = [] } = useGateStatusQuery()
  const { data: lastDetectionEntry } = useLastDetectionQuery()
  const { data: lastDetectionExit } = useLastDetectionExitQuery()
  const [loadingGate, setLoadingGate] = useState<'entry' | 'exit' | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const handleScan = async (gate: 'entry' | 'exit', plateNumber: string) => {
    setLoadingGate(gate)
    await apiParkingRepository.scanRfid(gate, plateNumber)
    await queryClient.invalidateQueries({ queryKey: ['gates'] })
    await queryClient.invalidateQueries({ queryKey: ['history'] })
    setLoadingGate(null)
  }

  const handleControlGate = async (gate: 'entry' | 'exit', action: 'open' | 'close') => {
    setLoadingGate(gate)
    try {
      await apiParkingRepository.controlGate(gate, action)
      await queryClient.invalidateQueries({ queryKey: ['gates'] })
    } catch (error) {
      console.error('Failed to control gate:', error)
    } finally {
      setLoadingGate(null)
    }
  }

  const handleConfirmPlate = async (gate: 'entry' | 'exit', isConfirmed: boolean, correctedPlate?: string) => {
    setLoadingGate(gate)
    setConfirmError(null)
    try {
      await apiParkingRepository.confirmGate(gate, isConfirmed, correctedPlate)
      await queryClient.invalidateQueries({ queryKey: ['gates'] })
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    } catch (error: any) {
      console.error('Failed to confirm gate:', error)
      setConfirmError(error.message || 'An error occurred during confirmation')
    } finally {
      setLoadingGate(null)
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Confirmation Modals */}
      {gates.map(gate => gate.status === 'waiting_confirmation' && (
        <ConfirmationModal 
          key={`confirm-${gate.gate}`}
          gate={gate.gate as any}
          plate={gate.pendingPlate || ''}
          expectedPlate={gate.expectedPlate}
          errorMsg={confirmError}
          entryTime={gate.entryTime}
          durationMinutes={gate.durationMinutes}
          totalFee={gate.totalFee}
          isLoading={loadingGate === gate.gate}
          onConfirm={(corrected) => handleConfirmPlate(gate.gate as any, true, corrected)}
          onReject={() => handleConfirmPlate(gate.gate as any, false)}
        />
      ))}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parking Overview Dashboard</h1>
      </div>

      {/* Top Section: Parking Slots Status */}
      <Card title="PARKING SLOTS">
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
                    {slot.status === 'occupied' ? 'Occupied' : 'Empty'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {slot.status === 'occupied' ? 'Vehicle parked' : 'Ready for parking'}
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

      {/* Bottom Section: Gate Status */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Cổng vào */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200 px-1">ENTRY GATE</h2>
          <div className="grid gap-4">
            {gates.filter(g => g.gate === 'entry').map((gate) => (
              <div key={gate.gate} className="relative space-y-4">
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-700 bg-black aspect-video relative group">
                    <img 
                      src="http://localhost:8000/api/video_feed" 
                      alt="Entry Gate Camera" 
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
                        <span className="text-[10px] font-bold uppercase tracking-wider">license capture</span>
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
                        <p className="text-[10px] text-slate-500 uppercase font-bold">license detect:</p>
                        <p className="text-lg font-black tracking-wider text-white mt-0.5">
                          {lastDetectionEntry?.plate && lastDetectionEntry.plate !== "Chưa có" ? lastDetectionEntry.plate : 'WAITING...'}
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
                      <p className="font-bold">STATUS</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        gate.isOpen ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${gate.isOpen ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                        {gate.isOpen ? 'Open' : 'Closed'}
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        gate.status === 'idle' ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {gate.status === 'idle' ? 'Ready' : 'Active'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Sensor</span>
                      <p className="text-sm font-medium text-slate-200">{GATE_STATUS_LABEL[gate.status]}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Message</span>
                      <p className={`text-sm font-medium italic transition-colors duration-300 ${
                        gate.message.includes('ERROR') || gate.message.includes('FULL') ? 'text-red-400 animate-pulse font-bold' : 'text-slate-300'
                      }`}>
                        "{gate.message}"
                      </p>
                    </div>
                  </div>

                    <RfidDisplay gate="entry" />

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button
                      type="button"
                      disabled={loadingGate === gate.gate}
                      onClick={() => handleControlGate(gate.gate, 'open')}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600/20 px-4 py-2.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 transition-all hover:bg-emerald-600/30 disabled:opacity-50"
                    >
                      <Unlock size={14} />
                      Open Gate
                    </button>
                    <button
                      type="button"
                      disabled={loadingGate === gate.gate}
                      onClick={() => handleControlGate(gate.gate, 'close')}
                      className="flex items-center justify-center gap-2 rounded-lg bg-red-600/20 px-4 py-2.5 text-xs font-bold text-red-400 border border-red-500/30 transition-all hover:bg-red-600/30 disabled:opacity-50"
                    >
                      <Lock size={14} />
                      Close Gate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cổng ra */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200 px-1">EXIT GATE</h2>
          <div className="grid gap-4">
            {gates.filter(g => g.gate === 'exit').map((gate) => (
              <div key={gate.gate} className="relative space-y-4">
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="flex-1 overflow-hidden rounded-xl border border-slate-700 bg-black aspect-video relative group">
                    <img 
                      src="http://localhost:8000/api/video_feed_exit" 
                      alt="Exit Gate Camera" 
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
                        <span className="text-[10px] font-bold uppercase tracking-wider">license capture</span>
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
                        <p className="text-[10px] text-slate-500 uppercase font-bold">license detect</p>
                        <p className="text-lg font-black tracking-wider text-white mt-0.5">
                          {lastDetectionExit?.plate && lastDetectionExit.plate !== "Chưa có" ? lastDetectionExit.plate : 'WAITING...'}
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
                      <p className="font-bold">STATUS</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        gate.isOpen ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${gate.isOpen ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                        {gate.isOpen ? 'Open' : 'Closed'}
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        gate.status === 'idle' ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {gate.status === 'idle' ? 'Ready' : 'Active'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Sensor</span>
                      <p className="text-sm font-medium text-slate-200">{GATE_STATUS_LABEL[gate.status]}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Message</span>
                      <p className={`text-sm font-medium italic transition-colors duration-300 ${
                        gate.message.includes('ERROR') || gate.message.includes('FULL') ? 'text-red-400 animate-pulse font-bold' : 'text-slate-300'
                      }`}>
                        "{gate.message}"
                      </p>
                    </div>
                  </div>

                    <RfidDisplay gate="exit" />

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button
                      type="button"
                      disabled={loadingGate === gate.gate}
                      onClick={() => handleControlGate(gate.gate, 'open')}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600/20 px-4 py-2.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 transition-all hover:bg-emerald-600/30 disabled:opacity-50"
                    >
                      <Unlock size={14} />
                      Open Gate
                    </button>
                    <button
                      type="button"
                      disabled={loadingGate === gate.gate}
                      onClick={() => handleControlGate(gate.gate, 'close')}
                      className="flex items-center justify-center gap-2 rounded-lg bg-red-600/20 px-4 py-2.5 text-xs font-bold text-red-400 border border-red-500/30 transition-all hover:bg-red-600/30 disabled:opacity-50"
                    >
                      <Lock size={14} />
                      Close Gate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
