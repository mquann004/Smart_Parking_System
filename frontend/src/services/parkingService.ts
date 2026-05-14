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

  async getHistory(search?: string, filter?: string): Promise<any[]> {
    let url = `${API_BASE_URL}/history`
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (filter) params.append('filter', filter)
    if (params.toString()) url += `?${params.toString()}`
    
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch history')
    return response.json()
  },

  async deleteHistory(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/history/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete history record')
  },

  async clearHistory(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to clear history')
  },

  async scanRfid(gate: 'entry' | 'exit', plateNumber: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/scan-rfid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate, plateNumber }),
    })
    if (!response.ok) throw new Error('Failed to scan RFID')
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
  },

  async getLastRfid(gate: 'entry' | 'exit'): Promise<{ uid: string | null; timestamp: string | null }> {
    const response = await fetch(`${API_BASE_URL}/last-rfid?gate=${gate}`)
    if (!response.ok) throw new Error('Failed to fetch last rfid')
    return response.json()
  },

  async controlGate(gate: 'entry' | 'exit', action: 'open' | 'close'): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/control-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gate, action }),
    })
    if (!response.ok) throw new Error('Failed to control gate')
  },

  async confirmGate(gate: 'entry' | 'exit', isConfirmed: boolean, correctedPlate?: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/gate/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gate, isConfirmed, correctedPlate }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to confirm gate' }))
      throw new Error(errorData.detail || 'Failed to confirm gate')
    }
  },

  async getPricingSettings(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/settings/pricing`)
    if (!response.ok) throw new Error('Failed to fetch pricing settings')
    return response.json()
  },

  async updatePricingSettings(settings: any): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/settings/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!response.ok) throw new Error('Failed to update pricing settings')
  }
}
