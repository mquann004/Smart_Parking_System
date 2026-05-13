import type { GateState, ParkingSession, ParkingSlot, Vehicle, GateEvent } from '../types/parking'
import { mockParkingService } from '../services/mockParkingService'
import { parkingService } from '../services/parkingService'

export interface ParkingRepository {
  getSlots: () => Promise<ParkingSlot[]>
  getActiveVehicles: () => Promise<Vehicle[]>
  getGateStatus: () => Promise<GateState[]>
  getLastDetection: () => Promise<{ plate: string; image: string | null; timestamp: string }>
  getLastDetectionExit: () => Promise<{ plate: string; image: string | null; timestamp: string }>
}

export const mockParkingRepository: ParkingRepository = {
  getSlots: () => mockParkingService.getSlots(),
  getActiveVehicles: () => mockParkingService.getActiveVehicles(),
  getGateStatus: () => mockParkingService.getGateStatus(),
  getHistory: () => mockParkingService.getHistory(),
  scanRfid: (gate, plateNumber) => mockParkingService.scanRfid(gate, plateNumber),
  calculateFee: (plateNumber, checkoutAt) => mockParkingService.calculateFee(plateNumber, checkoutAt),
  getLastDetection: () => Promise.resolve({ plate: "30A-123.45", image: null, timestamp: new Date().toISOString() }),
  getLastDetectionExit: () => Promise.resolve({ plate: "51F-678.90", image: null, timestamp: new Date().toISOString() })
}

export const apiParkingRepository: ParkingRepository = {
  getSlots: () => parkingService.getSlots(),
  getActiveVehicles: () => parkingService.getActiveVehicles(),
  getGateStatus: () => parkingService.getGateStatus(),
  getHistory: () => parkingService.getHistory(),
  scanRfid: (gate, plateNumber) => mockParkingService.scanRfid(gate, plateNumber), // Giữ mock cho RFID scan tay từ UI
  calculateFee: (plateNumber, checkoutAt) => parkingService.calculateFee(plateNumber, checkoutAt) as any,
  getLastDetection: () => parkingService.getLastDetection(),
  getLastDetectionExit: () => parkingService.getLastDetectionExit(),
}
