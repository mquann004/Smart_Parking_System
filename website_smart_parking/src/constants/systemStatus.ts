export const SLOT_COLOR = {
  occupied: 'bg-red-600',
  available: 'bg-green-600',
} as const

export const GATE_STATUS_LABEL: Record<string, string> = {
  idle: 'Sẵn sàng',
  vehicle_detected: 'Phát hiện xe',
  waiting_rfid: 'Chờ quét RFID',
  gate_open: 'Cổng đang mở',
  gate_closed: 'Cổng đã đóng',
}
