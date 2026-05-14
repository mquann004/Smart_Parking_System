export const SLOT_COLOR = {
  occupied: 'bg-red-600',
  available: 'bg-green-600',
} as const

export const GATE_STATUS_LABEL: Record<string, string> = {
  idle: 'Ready',
  vehicle_detected: 'Vehicle Detected',
  waiting_rfid: 'Waiting for RFID',
  waiting_confirmation: 'Waiting for Confirmation',
  gate_open: 'Gate Opened',
  gate_closed: 'Gate Closed',
}
