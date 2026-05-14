import { z } from 'zod'
import { seedFeePolicy, seedGateStates, seedHistory, seedSlots, seedVehicles } from '../mocks/seed'
import type { GateEvent, GateState, ParkingSession, ParkingSlot, Vehicle } from '../types/parking'
import { minutesBetween } from '../utils/time'

const slotSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['occupied', 'available']),
  plateNumber: z.string().optional(),
})

const vehicleSchema = z.object({
  id: z.string(),
  plateNumber: z.string(),
  type: z.enum(['car', 'motorbike']),
  slotId: z.string(),
  checkInAt: z.string(),
})

const gateStateSchema = z.object({
  gate: z.enum(['entry', 'exit']),
  status: z.enum(['idle', 'vehicle_detected', 'waiting_rfid', 'gate_open', 'gate_closed']),
  currentPlate: z.string().optional(),
  message: z.string(),
})

const delay = async (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

const slots = structuredClone(seedSlots)
const vehicles = structuredClone(seedVehicles)
let gateStates = structuredClone(seedGateStates)
let history = structuredClone(seedHistory)

const maybeFailRfid = () => Math.random() < 0.15

export const mockParkingService = {
  async getSlots(): Promise<ParkingSlot[]> {
    await delay()
    return slotSchema.array().parse(slots)
  },
  async getActiveVehicles(): Promise<Vehicle[]> {
    await delay()
    return vehicleSchema.array().parse(vehicles)
  },
  async getGateStatus(): Promise<GateState[]> {
    await delay(200)
    return gateStateSchema.array().parse(gateStates)
  },
  async getHistory(): Promise<GateEvent[]> {
    await delay(250)
    return [...history].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
  },
  async scanRfid(gate: 'entry' | 'exit', plateNumber: string): Promise<GateState> {
    await delay(600)
    const failed = maybeFailRfid()
    const base = gateStates.find((item) => item.gate === gate)
    if (!base) throw new Error('Gate not found')
    if (failed) {
      const rejectedEvent: GateEvent = {
        id: crypto.randomUUID(),
        gate,
        eventType: 'rejected',
        plateNumber,
        timestamp: new Date().toISOString(),
        success: false,
        note: 'RFID không hợp lệ',
      }
      history = [rejectedEvent, ...history]
      return { ...base, status: 'waiting_rfid', message: 'Thẻ lỗi, vui lòng quét lại', currentPlate: plateNumber }
    }
    const opened: GateState = { ...base, status: 'gate_open', message: 'RFID hợp lệ, cổng đang mở', currentPlate: plateNumber }
    gateStates = gateStates.map((item) => (item.gate === gate ? opened : item))
    const openedEvent: GateEvent = {
      id: crypto.randomUUID(),
      gate,
      eventType: 'gate_opened',
      plateNumber,
      timestamp: new Date().toISOString(),
      success: true,
      note: 'Xác thực RFID thành công',
    }
    history = [openedEvent, ...history]
    return opened
  },
  async calculateFee(plateNumber: string, checkoutAt: string): Promise<ParkingSession> {
    await delay(150)
    const vehicle = vehicles.find((item) => item.plateNumber === plateNumber)
    if (!vehicle) {
      throw new Error('Không tìm thấy xe để tính phí')
    }
    const totalMinutes = minutesBetween(vehicle.checkInAt, checkoutAt)
    const roundedMinutes = Math.ceil(totalMinutes / seedFeePolicy.roundToMinutes) * seedFeePolicy.roundToMinutes
    const totalFee = (roundedMinutes / 60) * seedFeePolicy.hourlyRate
    return {
      sessionId: crypto.randomUUID(),
      plateNumber,
      checkInAt: vehicle.checkInAt,
      checkOutAt: checkoutAt,
      durationMinutes: roundedMinutes,
      totalFee,
    }
  },
}
