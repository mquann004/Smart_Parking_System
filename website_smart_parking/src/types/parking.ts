export type SlotStatus = 'occupied' | 'available'
export type GateFlowStatus = 'idle' | 'vehicle_detected' | 'waiting_rfid' | 'gate_open' | 'gate_closed'
export type VehicleType = 'car' | 'motorbike'
export type GateType = 'entry' | 'exit'

export interface ParkingSlot {
  id: string
  label: string
  status: SlotStatus
  plateNumber?: string
}

export interface Vehicle {
  id: string
  plateNumber: string
  type: VehicleType
  slotId: string
  checkInAt: string
}

export interface GateState {
  gate: GateType
  status: GateFlowStatus
  currentPlate?: string
  message: string
}

export interface GateEvent {
  id: string
  gate: GateType
  eventType: 'detected' | 'rfid_scanned' | 'gate_opened' | 'gate_closed' | 'rejected'
  plateNumber: string
  timestamp: string
  success: boolean
  note: string
}

export interface ParkingSession {
  sessionId: string
  plateNumber: string
  checkInAt: string
  checkOutAt: string
  durationMinutes: number
  totalFee: number
}

export interface FeePolicy {
  hourlyRate: number
  roundToMinutes: number
}
