import { useState, useEffect } from 'react'
import { Card } from '../components/common/Card'
import { apiParkingRepository } from '../repositories/parkingRepository'
import { Settings, Save, Info, CheckCircle2, Clock } from 'lucide-react'

export default function Billing() {
  const [pricing, setPricing] = useState({
    first_hour_fee: 5000,
    next_hour_fee: 3000,
    overnight_fee: 20000,
    first_period_mins: 60,
    overnight_threshold_mins: 720
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await apiParkingRepository.getPricingSettings()
      if (data) setPricing(data)
    } catch (error) {
      console.error('Failed to load pricing settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await apiParkingRepository.updatePricingSettings(pricing)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      alert('Failed to update pricing settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading configuration...</div>
  }

  return (
    <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Parking Fee Configuration</h1>
          <p className="text-sm text-slate-400">Set up dynamic pricing and time rules for the system</p>
        </div>
        <Settings className="text-slate-700" size={32} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Fee & Time Settings">
            <div className="grid gap-6 p-2 md:grid-cols-2">
              {/* Cột 1: Giá tiền */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-500">First Period Fee</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricing.first_hour_fee}
                      onChange={(e) => setPricing({ ...pricing, first_hour_fee: parseInt(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-lg font-black text-white focus:border-blue-500 transition-all outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">$</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Subsequent Hourly Rate</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricing.next_hour_fee}
                      onChange={(e) => setPricing({ ...pricing, next_hour_fee: parseInt(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-lg font-black text-white focus:border-emerald-500 transition-all outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">$ / hr</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-orange-500">Overnight Fixed Fee</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricing.overnight_fee}
                      onChange={(e) => setPricing({ ...pricing, overnight_fee: parseInt(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-lg font-black text-white focus:border-orange-500 transition-all outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">$</span>
                  </div>
                </div>
              </div>

              {/* Cột 2: Thời gian */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-500">First Period Duration</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricing.first_period_mins}
                      onChange={(e) => setPricing({ ...pricing, first_period_mins: parseInt(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-lg font-black text-blue-400 focus:border-blue-500 transition-all outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">MIN</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-orange-500">Overnight Threshold</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricing.overnight_threshold_mins}
                      onChange={(e) => setPricing({ ...pricing, overnight_threshold_mins: parseInt(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-lg font-black text-orange-400 focus:border-orange-500 transition-all outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">MIN</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic mt-1">Tip: 720 min = 12 hours</p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : (
                  <>
                    <Save size={18} />
                    Save System Configuration
                  </>
                )}
              </button>

              {showSuccess && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-bold">Configuration updated successfully!</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Pricing Rules">
            <div className="space-y-4 p-2 text-sm text-slate-400">
              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 text-blue-400">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-300">Initial Period:</p>
                  <p>A flat fee of ${pricing.first_hour_fee.toLocaleString()} is applied for the first {pricing.first_period_mins} minutes of parking.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 text-emerald-400">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-300">Hourly Rate:</p>
                  <p>After the first {pricing.first_period_mins} minutes, each subsequent hour (or fraction thereof) adds ${pricing.next_hour_fee.toLocaleString()}.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-1 flex-shrink-0 text-orange-400">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-300">Overnight Mode:</p>
                  <p>If the total duration exceeds {pricing.overnight_threshold_mins} minutes ({Math.floor(pricing.overnight_threshold_mins/60)} hours), a fixed overnight fee of ${pricing.overnight_fee.toLocaleString()} is applied.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
