import { create } from 'zustand'
import type { GateState, ParkingSession } from '../types/parking'

interface ParkingUiState {
  gatePreview: GateState[]
  latestSession: ParkingSession | null
  setGatePreview: (gatePreview: GateState[]) => void
  setLatestSession: (session: ParkingSession | null) => void
}

export const useParkingStore = create<ParkingUiState>((set) => ({
  gatePreview: [],
  latestSession: null,
  setGatePreview: (gatePreview) => set({ gatePreview }),
  setLatestSession: (latestSession) => set({ latestSession }),
}))
