import type { GateEvent, GateState, ParkingSlot, Vehicle } from '../types/parking'

const API_BASE_URL = 'http://localhost:8000/api'

export const parkingService = {
  async getSlots(): Promise<ParkingSlot[]> {
    const response = await fetch(`${API_BASE_URL}/slots`)
    if (!response.ok) throw new Error('Failed to fetch slots')
    return response.json()
  },

  async getActiveVehicles(): Promise<Vehicle[]> {
    const response = await fetch(`${API_BASE_URL}/active-vehicles`)
    if (!response.ok) throw new Error('Failed to fetch active vehicles')
    return response.json()
  },

  async getGateStatus(): Promise<GateState[]> {
    const response = await fetch(`${API_BASE_URL}/gate-status`)
    if (!response.ok) throw new Error('Failed to fetch gate status')
    return response.json()
  },

  async getHistory(): Promise<GateEvent[]> {
    const response = await fetch(`${API_BASE_URL}/history`)
    if (!response.ok) throw new Error('Failed to fetch history')
    return response.json()
  },

  // Giữ lại các mock cho các hành động chưa có backend thực thi (ví dụ: tính phí hoặc scan tay)
  async calculateFee(plateNumber: string, checkoutAt: string) {
    console.log('Calculating fee for', plateNumber, checkoutAt)
    return {
        sessionId: crypto.randomUUID(),
        plateNumber,
        checkInAt: new Date().toISOString(),
        checkOutAt: checkoutAt,
        durationMinutes: 60,
        totalFee: 5000,
    }
  },

  async getLastDetection(): Promise<{ plate: string; image: string | null; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/last_detection`)
    if (!response.ok) throw new Error('Failed to fetch last detection')
    return response.json()
  },

  async getLastDetectionExit(): Promise<{ plate: string; image: string | null; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/last_detection_exit`)
    if (!response.ok) throw new Error('Failed to fetch last detection exit')
    return response.json()
  }
}
