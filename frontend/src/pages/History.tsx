import { useState } from 'react'
import { Card } from '../components/common/Card'
import { useHistoryQuery } from '../hooks/useParkingData'
import { toDateTime } from '../utils/time'
import { Search, Trash2, Clock, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiParkingRepository } from '../repositories/parkingRepository'
import { useQueryClient } from '@tanstack/react-query'

export default function History() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState('all')
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const { data: history = [], isLoading } = useHistoryQuery(searchTerm, timeFilter !== 'all' ? timeFilter : undefined)

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return
    setIsDeleting(id)
    try {
      await apiParkingRepository.deleteHistory(id)
      queryClient.invalidateQueries({ queryKey: ['history'] })
    } catch (error) {
      alert('Failed to delete record')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete ALL history? This action cannot be undone.')) return
    try {
      await apiParkingRepository.clearHistory()
      queryClient.invalidateQueries({ queryKey: ['history'] })
    } catch (error) {
      alert('Failed to clear history')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Access Logs</h1>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95"
        >
          <Trash2 size={16} />
          Clear All History
        </button>
      </div>

      {/* Toolbar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by UID or Plate Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="relative group">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-10 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="all">All Time</option>
            <option value="1h">Last Hour</option>
            <option value="2h">Last 2 Hours</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Filter size={16} />
          </div>
        </div>
      </div>

      <Card title={`Records (${history.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Card UID</th>
                <th className="px-4 py-2">Plate Number</th>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">Loading access logs...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">No records found.</td>
                </tr>
              ) : (
                history.map((record, index) => (
                  <tr key={record.id} className="group bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
                    <td className="rounded-l-xl px-4 py-4 text-slate-500 font-medium">#{index + 1}</td>
                    <td className="px-4 py-4">
                      <code className="rounded bg-slate-900 px-2 py-1 text-xs text-blue-400 font-mono">{record.uid}</code>
                    </td>
                    <td className="px-4 py-4 font-bold tracking-wider text-slate-200">
                      {record.license_plate || '---'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        record.type === 'IN' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${record.type === 'IN' ? 'bg-emerald-400' : 'bg-orange-400'}`} />
                        {record.type === 'IN' ? 'Check-in' : 'Check-out'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-400">
                      {toDateTime(record.timestamp)}
                    </td>
                    <td className="rounded-r-xl px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(record.id)}
                        disabled={isDeleting === record.id}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                        title="Delete record"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
