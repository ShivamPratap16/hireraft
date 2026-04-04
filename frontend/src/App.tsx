import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Landing from './pages/marketing/Landing'
import Privacy from './pages/marketing/Privacy'
import Terms from './pages/marketing/Terms'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminActivity from './pages/admin/AdminActivity'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import { useAuth } from './lib/auth'
import { api } from './lib/api'
import { Avatar, ThemeToggle } from './components/ui'
import {
  LayoutDashboard, Bot, ScrollText, LogOut, UserCircle,
  Menu, X, Zap, Bell, ShieldAlert
} from 'lucide-react'
import { format } from 'date-fns'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/automation', label: 'Automation', icon: Bot },
  { to: '/logs', label: 'Logs', icon: ScrollText },
]

function navItemActive(pathname: string, to: string) {
  if (to === '/dashboard') return pathname === '/dashboard'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 30_000,
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(false),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      qc.invalidateQueries({ queryKey: ['notifCount'] })
    }
  }, [open, qc])

  const markRead = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const unread = countData?.count ?? 0

  return (
    <div className="relative px-3 pb-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
          text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-all"
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span className="flex-1 text-left">Notifications</span>
        {unread > 0 && (
          <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-3 right-3 bottom-full mb-2 z-[60] max-h-[min(70vh,420px)] overflow-hidden flex flex-col
            glass rounded-xl border border-[var(--border-hover)] shadow-xl animate-slide-up"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Inbox</span>
            {notifications?.some((n) => !n.read) && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-[10px] text-brand-400 hover:underline disabled:opacity-50"
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[min(60vh,360px)]">
            {!notifications?.length ? (
              <p className="text-xs text-[var(--text-muted)] px-3 py-6 text-center">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id)
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)]/50 hover:bg-[var(--surface-3)]/80 transition-colors ${
                    !n.read ? 'bg-brand-500/5' : ''
                  }`}
                >
                  <p className="text-xs font-medium text-[var(--text-primary)]">{n.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                  {n.created_at && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 tabular-nums">
                      {format(new Date(n.created_at), 'MMM d, HH:mm')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProtectedLayout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  })

  const { data: runStatus } = useQuery({
    queryKey: ['runStatus'],
    queryFn: api.getRunStatus,
    refetchInterval: 5000,
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isRunning = runStatus?.running ?? false

  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden animate-fade-in backdrop-blur-sm bg-[var(--overlay-scrim)]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-[var(--surface-1)] border-r border-[var(--border)]
        flex flex-col transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {isRunning && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500 animate-gradient z-50" />
        )}

        <div className="px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent leading-tight">
                HireRaft
              </h1>
              <p className="text-[10px] text-[var(--text-muted)] font-medium tracking-wider uppercase">
                Auto-Apply Engine
              </p>
            </div>
          </div>
          <button className="md:hidden p-1 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] transition-colors" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {isRunning && (
          <div className="mx-4 mb-1 px-3 py-2.5 rounded-xl glass flex items-center gap-2.5 animate-slide-up">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
            </span>
            <span className="text-xs text-brand-400 font-medium">Bot is running...</span>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const isActive = navItemActive(location.pathname, to)
            const followDue = label === 'Dashboard' ? (stats?.follow_ups_due ?? 0) : 0
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand-500" />
                )}
                <Icon size={18} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                {label}
                {followDue > 0 && (
                  <span
                    className="ml-auto min-w-[1.25rem] h-5 px-1 rounded-full bg-attention-500/25 text-attention-300 text-[10px] font-bold flex items-center justify-center"
                    title="Follow-ups due"
                  >
                    {followDue > 99 ? '99+' : followDue}
                  </span>
                )}
                {label === 'Logs' && isRunning && (
                  <span className="ml-auto relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                  </span>
                )}
              </NavLink>
            )
          })}
          
          {user?.role === 'admin' && (
             <NavLink
               to="/admin/dashboard"
               className="group flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-medium transition-all duration-150 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-500 border border-indigo-500/20"
               onClick={() => setSidebarOpen(false)}
             >
               <ShieldAlert size={18} className="group-hover:scale-110 transition-transform" />
               Admin Panel
             </NavLink>
          )}
        </nav>

        <div className="px-3 pb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] pl-1">
            Theme
          </span>
          <ThemeToggle />
        </div>

        <NotificationBell />

        <div className="px-3 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar name={user?.name || user?.email || ''} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-muted)]
              hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-auto">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              HireRaft
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle variant="icon" />
            {isRunning && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function useHomeRoute() {
  const { user } = useAuth()
  return user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
}

function LandingRoute() {
  const { isAuthenticated } = useAuth()
  const home = useHomeRoute()
  if (isAuthenticated) return <Navigate to={home} replace />
  return <Landing />
}

function NotFoundRedirect() {
  const { isAuthenticated } = useAuth()
  const home = useHomeRoute()
  return <Navigate to={isAuthenticated ? home : '/'} replace />
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const home = useHomeRoute()

  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={home} replace /> : <Register />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="automation" element={<Settings />} />
        <Route path="logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  )
}
