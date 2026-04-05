import { useState } from 'react'
import { NavLink, Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { LayoutDashboard, Users, LogOut, ShieldAlert, Activity, BarChart3, Menu, X } from 'lucide-react'
import { Avatar, ThemeToggle } from '../../components/ui'

const NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/activity', label: 'Activity Feed', icon: Activity },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function AdminLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-72 bg-[var(--surface-1)] border-r border-[var(--border)]
        flex flex-col transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-6 py-6 flex items-center justify-between border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/15"><ShieldAlert className="text-red-400 w-5 h-5" /></div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-wide">Admin Center</h1>
              <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-widest">HireRaft Control</p>
            </div>
          </div>
          <button className="md:hidden text-[var(--text-muted)]" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                }`
              }>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <NavLink to="/dashboard" onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-emerald-500 hover:bg-emerald-500/10 transition-all">
              <LogOut size={18} />
              Back to App
            </NavLink>
          </div>
        </nav>

        <div className="px-3 pb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] pl-1">Theme</span>
          <ThemeToggle />
        </div>

        <div className="px-4 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar name={user?.name || user?.email || 'A'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.name || user?.email}</p>
              <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Administrator</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/') }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--text-muted)]"><Menu size={22} /></button>
          <ShieldAlert className="text-red-400 w-5 h-5" />
          <span className="text-sm font-bold text-[var(--text-primary)]">Admin Center</span>
        </div>
        <main className="flex-1 p-6 md:p-8 overflow-auto bg-[var(--surface-0)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
