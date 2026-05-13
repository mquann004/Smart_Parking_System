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

export const useHistoryQuery = () =>
  useQuery({
    queryKey: ['history'],
    queryFn: apiParkingRepository.getHistory,
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
