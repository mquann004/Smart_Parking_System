import type { GateState, ParkingSession, ParkingSlot, Vehicle, GateEvent } from '../types/parking'
import { mockParkingService } from '../services/mockParkingService'
import { parkingService } from '../services/parkingService'

export interface ParkingRepository {
  getSlots: () => Promise<ParkingSlot[]>
  getActiveVehicles: () => Promise<Vehicle[]>
  getGateStatus: () => Promise<GateState[]>
  getHistory: (search?: string, filter?: string) => Promise<any[]>
  deleteHistory: (id: number) => Promise<void>
  clearHistory: () => Promise<void>
  scanRfid: (gate: 'entry' | 'exit', plateNumber: string) => Promise<void>
  calculateFee: (plateNumber: string, checkoutAt: string) => Promise<any>
  getLastDetection: () => Promise<{ plate: string; image: string | null; timestamp: string }>
  getLastDetectionExit: () => Promise<{ plate: string; image: string | null; timestamp: string }>
  getLastRfid: (gate: 'entry' | 'exit') => Promise<{ uid: string | null; timestamp: string | null }>
  controlGate: (gate: 'entry' | 'exit', action: 'open' | 'close') => Promise<void>
  confirmGate: (gate: 'entry' | 'exit', isConfirmed: boolean, correctedPlate?: string) => Promise<void>
  getPricingSettings: () => Promise<any>
  updatePricingSettings: (settings: any) => Promise<void>
}

export const mockParkingRepository: ParkingRepository = {
  getSlots: () => mockParkingService.getSlots(),
  getActiveVehicles: () => mockParkingService.getActiveVehicles(),
  getGateStatus: () => mockParkingService.getGateStatus(),
  getHistory: () => Promise.resolve([]),
  deleteHistory: () => Promise.resolve(),
  clearHistory: () => Promise.resolve(),
  scanRfid: (gate, plateNumber) => mockParkingService.scanRfid(gate, plateNumber),
  calculateFee: (plateNumber, checkoutAt) => mockParkingService.calculateFee(plateNumber, checkoutAt),
  getLastDetection: () => Promise.resolve({ plate: "30A-123.45", image: null, timestamp: new Date().toISOString() }),
  getLastDetectionExit: () => Promise.resolve({ plate: "51F-678.90", image: null, timestamp: new Date().toISOString() }),
  getLastRfid: (gate) => Promise.resolve({ uid: gate === 'entry' ? "1A 2B 3C 4D" : "5E 6F 7G 8H", timestamp: new Date().toISOString() }),
  controlGate: (gate, action) => {
    console.log(`Mock: ${action} gate ${gate}`)
    return Promise.resolve()
  },
  confirmGate: (gate, isConfirmed, correctedPlate) => {
    console.log(`Mock: ${isConfirmed ? 'confirmed' : 'rejected'} gate ${gate} with plate ${correctedPlate}`)
    return Promise.resolve()
  },
  getPricingSettings: () => Promise.resolve({ first_hour_fee: 5000, next_hour_fee: 3000, overnight_fee: 20000 }),
  updatePricingSettings: () => Promise.resolve()
}

export const apiParkingRepository: ParkingRepository = {
  getSlots: () => parkingService.getSlots(),
  getActiveVehicles: () => parkingService.getActiveVehicles(),
  getGateStatus: () => parkingService.getGateStatus(),
  getHistory: (search, filter) => parkingService.getHistory(search, filter),
  deleteHistory: (id) => parkingService.deleteHistory(id),
  clearHistory: () => parkingService.clearHistory(),
  scanRfid: (gate, plateNumber) => parkingService.scanRfid(gate, plateNumber),
  calculateFee: (plateNumber, checkoutAt) => parkingService.calculateFee(plateNumber, checkoutAt) as any,
  getLastDetection: () => parkingService.getLastDetection(),
  getLastDetectionExit: () => parkingService.getLastDetectionExit(),
  getLastRfid: (gate) => parkingService.getLastRfid(gate),
  controlGate: (gate, action) => parkingService.controlGate(gate, action),
  confirmGate: (gate, isConfirmed, correctedPlate) => parkingService.confirmGate(gate, isConfirmed, correctedPlate),
  getPricingSettings: () => parkingService.getPricingSettings(),
  updatePricingSettings: (settings) => parkingService.updatePricingSettings(settings),
}
