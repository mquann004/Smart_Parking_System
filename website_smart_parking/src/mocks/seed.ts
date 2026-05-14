import type { FeePolicy, GateEvent, GateState, ParkingSlot, Vehicle } from '../types/parking'

const now = Date.now()

export const seedSlots: ParkingSlot[] = [
  { id: 'slot-1', label: 'SLOT 1', status: 'occupied', plateNumber: '51H-123.45' },
  { id: 'slot-2', label: 'SLOT 2', status: 'available' },
  { id: 'slot-3', label: 'SLOT 3', status: 'occupied', plateNumber: '59A-998.11' },
]

export const seedVehicles: Vehicle[] = [
  {
    id: 'vehicle-1',
    plateNumber: '51H-123.45',
    type: 'car',
    slotId: 'slot-1',
    checkInAt: new Date(now - 90 * 60000).toISOString(),
  },
  {
    id: 'vehicle-2',
    plateNumber: '59A-998.11',
    type: 'motorbike',
    slotId: 'slot-3',
    checkInAt: new Date(now - 35 * 60000).toISOString(),
  },
]

export const seedGateStates: GateState[] = [
  { gate: 'entry', status: 'vehicle_detected', currentPlate: '30G-777.88', message: 'Mời quét thẻ RFID để vào bãi' },
  { gate: 'exit', status: 'idle', message: 'Cổng ra sẵn sàng' },
]

export const seedHistory: GateEvent[] = [
  {
    id: 'event-1',
    gate: 'entry',
    eventType: 'detected',
    plateNumber: '30G-777.88',
    timestamp: new Date(now - 15 * 60000).toISOString(),
    success: true,
    note: 'Xe đến cổng vào',
  },
  {
    id: 'event-2',
    gate: 'exit',
    eventType: 'gate_opened',
    plateNumber: '52M-111.22',
    timestamp: new Date(now - 40 * 60000).toISOString(),
    success: true,
    note: 'Cổng ra mở thành công',
  },
]

export const seedFeePolicy: FeePolicy = {
  hourlyRate: 5000,
  roundToMinutes: 30,
}
