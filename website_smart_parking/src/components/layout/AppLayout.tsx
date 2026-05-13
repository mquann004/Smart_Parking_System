import { Link, NavLink, Outlet } from 'react-router-dom'
import { CarFront, Clock3, CreditCard, DoorOpen, LayoutDashboard } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'Lịch sử', icon: Clock3 },
  { to: '/billing', label: 'Tính phí', icon: CreditCard },
]

import { useVehiclesQuery } from '../../hooks/useParkingData'
import { Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function AppLayout() {
  const { data: vehicles = [] } = useVehiclesQuery()
  const [netSpeed, setNetSpeed] = useState('0.0')

  useEffect(() => {
    // @ts-ignore
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      const updateSpeed = () => setNetSpeed(conn.downlink?.toFixed(1) || '0.0')
      conn.addEventListener('change', updateSpeed)
      updateSpeed()
      return () => conn.removeEventListener('change', updateSpeed)
    }
  }, [])

  return (
    <div className="min-h-screen bg-parking-bg text-slate-100">
      <header className="border-b border-slate-700 bg-slate-900/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Hệ thống bãi đỗ xe thông minh
            </Link>
            <div className="hidden items-center gap-2 rounded-full bg-slate-800/50 px-3 py-1 text-xs text-slate-300 md:flex">
              <Wifi size={14} className="text-emerald-400" />
              <span>Network: <span className="font-mono text-emerald-400">{netSpeed} Mbps</span></span>
            </div>
          </div>
          
          <Link 
            to="/vehicles" 
            className="group flex items-center gap-3 rounded-xl bg-slate-800/50 p-1 pr-4 transition-all hover:bg-slate-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600/20 text-cyan-400">
              <CarFront size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Xe trong bãi</span>
              <span className="text-sm font-bold leading-none text-white">{vehicles.length} Xe</span>
            </div>
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
