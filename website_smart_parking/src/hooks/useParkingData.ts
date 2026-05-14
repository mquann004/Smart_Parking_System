import { useQuery } from '@tanstack/react-query'
import { apiParkingRepository } from '../repositories/parkingRepository'

export const useSlotsQuery = () =>
  useQuery({
    queryKey: ['slots'],
    queryFn: apiParkingRepository.getSlots,
    refetchInterval: 3000,
  })

export const useVehiclesQuery = () =>
  useQuery({
    queryKey: ['vehicles'],
    queryFn: apiParkingRepository.getActiveVehicles,
    refetchInterval: 3000,
  })

export const useGateStatusQuery = () =>
  useQuery({
    queryKey: ['gates'],
    queryFn: apiParkingRepository.getGateStatus,
    refetchInterval: 2000,
  })

export const useHistoryQuery = (search?: string, filter?: string) =>
  useQuery({
    queryKey: ['history', search, filter],
    queryFn: () => apiParkingRepository.getHistory(search, filter),
    refetchInterval: 5000,
  })

export const useLastDetectionQuery = () =>
  useQuery({
    queryKey: ['lastDetection'],
    queryFn: apiParkingRepository.getLastDetection,
    refetchInterval: 1000,
  })

export const useLastDetectionExitQuery = () =>
  useQuery({
    queryKey: ['lastDetectionExit'],
    queryFn: apiParkingRepository.getLastDetectionExit,
    refetchInterval: 1000,
  })

export const useLastRfidQuery = (gate: 'entry' | 'exit') =>
  useQuery({
    queryKey: ['lastRfid', gate],
    queryFn: () => apiParkingRepository.getLastRfid(gate),
    refetchInterval: 1000,
  })
