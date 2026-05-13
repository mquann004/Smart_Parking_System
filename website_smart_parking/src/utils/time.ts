import { formatDistanceStrict, format } from 'date-fns'

export const toDateTime = (iso: string): string => format(new Date(iso), 'dd/MM/yyyy HH:mm:ss')

export const timeAgoStrict = (iso: string): string =>
  formatDistanceStrict(new Date(iso), new Date(), { addSuffix: true })

export const minutesBetween = (from: string, to: string): number =>
  Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 60000))
