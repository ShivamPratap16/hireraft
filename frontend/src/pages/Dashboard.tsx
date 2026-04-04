import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Application } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Button, Card, Badge, statusVariant, platformVariant, EmptyState, Avatar } from '../components/ui'
import Skeleton from '../components/ui/Skeleton'
import {
  Play, ExternalLink, ChevronLeft, ChevronRight, Download,
  Search, CalendarDays, Briefcase, TrendingUp, Eye, MessageSquare, XCircle,
  Rocket, Settings, FileText, ArrowRight, ChevronDown, StickyNote, BellRing,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const STATUSES = ['', 'applied', 'viewed', 'interview', 'rejected', 'manual_apply_needed']
const PLATFORMS = ['', 'linkedin', 'indeed', 'naukri', 'internshala']

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  internshala: 'Internshala',
}

const PIE_COLORS = ['#22d3ee', '#34d399', '#fbbf24', '#60a5fa']

export default function Dashboard() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [running, setRunning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [runMenuOpen, setRunMenuOpen] = useState(false)
  const runMenuRef = useRef<HTMLDivElement>(null)
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false)
  const [notesModal, setNotesModal] = useState<Application | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [followUpDraft, setFollowUpDraft] = useState('')

  const { data: platformSettings } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: api.getPlatformSettings,
  })
  const enabledPlatforms = (platformSettings ?? []).filter((p) => p.enabled).map((p) => p.platform)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) setRunMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const { data: runStatus } = useQuery({
    queryKey: ['runStatus'],
    queryFn: api.getRunStatus,
    refetchInterval: running ? 2000 : 10000,
  })

  useEffect(() => {
    if (runStatus) {
      if (running && !runStatus.running) {
        toast('success', 'Bot run completed! Check your applications.')
        qc.invalidateQueries({ queryKey: ['applications'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
        qc.invalidateQueries({ queryKey: ['analytics'] })
      }
      setRunning(runStatus.running)
    }
  }, [runStatus])

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page, platform, status, searchQuery, dateFrom, dateTo, followUpDueOnly],
    queryFn: () => api.getApplications({
      page, page_size: 15, platform, status,
      search: searchQuery, date_from: dateFrom, date_to: dateTo,
      ...(followUpDueOnly ? { follow_up_due: true } : {}),
    }),
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
  })

  const { data: analytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: api.getAnalytics,
    enabled: (stats?.total ?? 0) > 0,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateApplication(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast('success', 'Status updated')
    },
    onError: () => toast('error', 'Failed to update status'),
  })

  const notesMutation = useMutation({
    mutationFn: ({
      id,
      notes,
      follow_up_date,
    }: { id: number; notes: string; follow_up_date: string }) =>
      api.updateApplication(id, { notes, follow_up_date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setNotesModal(null)
      toast('success', 'Notes saved')
    },
    onError: () => toast('error', 'Failed to save notes'),
  })

  useEffect(() => {
    if (notesModal) {
      setNotesDraft(notesModal.notes ?? '')
      setFollowUpDraft(notesModal.follow_up_date ?? '')
    }
  }, [notesModal])

  const handleTrigger = async () => {
    setRunning(true)
    setRunMenuOpen(false)
    try {
      const result = await api.triggerRun()
      toast('info', result.message)
    } catch {
      toast('error', 'Failed to start bot run')
      setRunning(false)
    }
  }

  const handleTriggerPlatform = async (plat: string) => {
    setRunning(true)
    setRunMenuOpen(false)
    try {
      const result = await api.triggerRun([plat])
      toast('info', result.message)
    } catch {
      toast('error', 'Failed to start bot run')
      setRunning(false)
    }
  }

  const handleExport = () => {
    const token = localStorage.getItem('jp_token')
    const params = new URLSearchParams()
    if (platform) params.set('platform', platform)
    if (status) params.set('status', status)
    fetch(`/api/applications/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'hireraft_applications.csv'
        a.click()
        URL.revokeObjectURL(a.href)
        toast('success', 'CSV downloaded')
      })
      .catch(() => toast('error', 'Export failed'))
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1
  const greeting = getGreeting()
  const isNewUser = stats && stats.total === 0

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name || user?.email || ''} size="lg" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {greeting}, {user?.name || 'there'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {isNewUser
                ? 'Get started by setting up your first platform'
                : `You have ${stats?.total ?? 0} applications tracked`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="secondary" onClick={handleExport} disabled={!!isNewUser} icon={<Download size={16} />}>
            <span className="hidden sm:inline">Export</span>
          </Button>
          <div className="relative" ref={runMenuRef}>
            <div className="flex rounded-xl overflow-hidden shadow-md">
              <Button
                className="rounded-r-none border-r border-white/10"
                onClick={handleTrigger}
                loading={running}
                disabled={enabledPlatforms.length === 0}
                icon={running ? undefined : <Play size={16} />}
              >
                {running ? 'Running...' : 'Run all'}
              </Button>
              <Button
                variant="primary"
                className="rounded-l-none px-2.5 min-w-0"
                onClick={() => setRunMenuOpen((o) => !o)}
                disabled={running || enabledPlatforms.length === 0}
                aria-label="Choose platform to run"
              >
                <ChevronDown size={18} className={runMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </Button>
            </div>
            {runMenuOpen && enabledPlatforms.length > 0 && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] glass rounded-xl border border-[var(--border-hover)] py-1 shadow-xl animate-slide-up">
                {enabledPlatforms.map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => handleTriggerPlatform(plat)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
                  >
                    Run {PLATFORM_LABELS[plat] ?? plat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding for new users */}
      {isNewUser && (
        <Card className="bg-gradient-to-br from-brand-500/5 to-brand-700/5 border-brand-500/10 animate-slide-up" hover={false}>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Get started in 3 steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OnboardingStep step={1} icon={FileText} title="Upload Resume" desc="Add your resume so bots can attach it" link="/automation" />
            <OnboardingStep step={2} icon={Settings} title="Configure Platform" desc="Add credentials and enable a platform" link="/automation" />
            <OnboardingStep step={3} icon={Rocket} title="Run the Bot" desc="Hit 'Run Now' and watch it apply" link="/dashboard" />
          </div>
        </Card>
      )}

      {/* Stats cards */}
      {stats && !isNewUser && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={Briefcase} color="text-[var(--text-primary)]" iconColor="text-brand-400" bgIcon="bg-brand-500/10" />
          <StatCard label="Applied" value={stats.by_status.applied} icon={TrendingUp} color="text-blue-400" iconColor="text-blue-400" bgIcon="bg-blue-500/10" />
          <StatCard label="Viewed" value={stats.by_status.viewed} icon={Eye} color="text-amber-400" iconColor="text-amber-400" bgIcon="bg-amber-500/10" />
          <StatCard label="Interview" value={stats.by_status.interview} icon={MessageSquare} color="text-emerald-400" iconColor="text-emerald-400" bgIcon="bg-emerald-500/10" />
          <StatCard label="Rejected" value={stats.by_status.rejected} icon={XCircle} color="text-red-400" iconColor="text-red-400" bgIcon="bg-red-500/10" />
          <StatCard label="Follow-ups due" value={stats.follow_ups_due ?? 0} icon={BellRing} color="text-attention-400" iconColor="text-attention-400" bgIcon="bg-attention-500/10" />
        </div>
      )}

      {/* Analytics charts */}
      {analytics && !isNewUser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up">
          <Card hover={false} padding="sm">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Applications (30 days)</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.daily_applications}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(v: string) => format(parseISO(v), 'MMM d')}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} width={32} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}
                    labelFormatter={(v) => format(parseISO(String(v)), 'MMM d, yyyy')}
                  />
                  <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} name="Applications" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card hover={false} padding="sm">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">By platform</p>
            <div className="h-[220px] w-full flex items-center">
              {Object.values(analytics.by_platform).some((c) => c > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(analytics.by_platform)
                        .filter(([, c]) => c > 0)
                        .map(([name, value]) => ({ name: PLATFORM_LABELS[name] ?? name, value }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {Object.entries(analytics.by_platform)
                        .filter(([, c]) => c > 0)
                        .map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="w-full text-center text-sm text-[var(--text-muted)]">No platform data yet</p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-xs text-[var(--text-muted)] mt-2">
              <span>
                This week: <strong className="text-[var(--text-primary)]">{analytics.this_week_count}</strong>
              </span>
              <span>
                Last week: <strong className="text-[var(--text-primary)]">{analytics.prev_week_count}</strong>
              </span>
              <span>
                Success rate:{' '}
                <strong className="text-[var(--text-primary)]">
                  {analytics.success_rate_percent != null ? `${analytics.success_rate_percent}%` : '—'}
                </strong>
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              placeholder="Search by job title or company..."
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl pl-10 pr-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => { setPlatform(e.target.value); setPage(1) }}
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all cursor-pointer"
          >
            <option value="">All Platforms</option>
            {PLATFORMS.filter(Boolean).map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all duration-150 ${
              showFilters || dateFrom || dateTo
                ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
            }`}
          >
            <CalendarDays size={16} />
            Date
          </button>
          <button
            type="button"
            onClick={() => { setFollowUpDueOnly((v) => !v); setPage(1) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all duration-150 ${
              followUpDueOnly
                ? 'bg-attention-500/10 border-attention-500/20 text-attention-400'
                : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
            }`}
          >
            <BellRing size={16} />
            Follow-ups due
            {(stats?.follow_ups_due ?? 0) > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-attention-500/30 text-[10px] font-bold tabular-nums flex items-center justify-center">
                {stats!.follow_ups_due}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 items-center glass rounded-xl px-4 py-3 animate-slide-up">
            <span className="text-xs text-[var(--text-muted)]">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            <span className="text-xs text-[var(--text-muted)]">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <Card padding="sm" className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left">
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider">Job Title</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Company</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider">Platform</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Also on</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Applied</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider w-10">Notes</th>
                <th className="px-5 py-3.5 font-medium text-xs uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="px-5 py-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-5 py-4 hidden sm:table-cell"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-lg" /></td>
                    <td className="px-5 py-4 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-5 py-4 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-6 w-20 rounded-lg" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-5 py-4"><Skeleton className="h-4 w-4" /></td>
                  </tr>
                ))
              ) : !data?.items.length ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<Briefcase className="w-8 h-8" />}
                      title={searchQuery || platform || status ? 'No matching applications' : 'No applications yet'}
                      description={searchQuery || platform || status
                        ? 'Try adjusting your filters to see more results'
                        : 'Hit "Run Now" to start auto-applying to jobs!'}
                    />
                  </td>
                </tr>
              ) : (
                data.items.map((app, i) => (
                  <tr
                    key={app.id}
                    className="border-b border-[var(--border)]/30 hover:bg-[var(--surface-2)]/50 transition-colors group animate-fade-in"
                    style={{ animationDelay: `${i * 0.02}s` }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[var(--text-primary)] font-medium max-w-[250px] truncate">{app.job_title}</p>
                      <p className="text-xs text-[var(--text-muted)] sm:hidden truncate">{app.company_name}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-secondary)] hidden sm:table-cell">{app.company_name}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={platformVariant(app.platform)} dot>
                        {app.platform.charAt(0).toUpperCase() + app.platform.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {app.other_platforms?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {app.other_platforms.map((op) => (
                            <span
                              key={op}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--text-muted)]"
                              title="Same job on another platform"
                            >
                              {PLATFORM_LABELS[op] ?? op}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">
                      {app.applied_at ? format(new Date(app.applied_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(app.status)}>
                          {app.status.replace(/_/g, ' ')}
                        </Badge>
                        <select
                          value={app.status}
                          onChange={(e) => statusMutation.mutate({ id: app.id, status: e.target.value })}
                          className="bg-transparent border-none text-xs text-[var(--text-muted)] focus:outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity w-4"
                          title="Change status"
                        >
                          {STATUSES.filter(Boolean).map((s) => (
                            <option key={s} value={s} className="bg-[var(--surface-1)] text-[var(--text-primary)]">{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setNotesModal(app)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          app.notes || app.follow_up_date
                            ? 'text-brand-400 bg-brand-500/10'
                            : 'text-[var(--text-muted)] hover:text-brand-400 hover:bg-[var(--surface-3)]'
                        }`}
                        title="Notes & follow-up"
                      >
                        <StickyNote size={16} />
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <a
                        href={app.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--text-muted)] hover:text-brand-400 transition-colors opacity-50 group-hover:opacity-100"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > data.page_size && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {(page - 1) * data.page_size + 1}–{Math.min(page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] disabled:opacity-30 text-[var(--text-muted)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page + i - 2
                if (p < 1 || p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-xl text-xs font-medium transition-all duration-150 ${
                      p === page
                        ? 'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow-md'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] disabled:opacity-30 text-[var(--text-muted)] transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {notesModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in bg-[var(--overlay-scrim)]"
          role="dialog"
          aria-modal="true"
          onClick={() => setNotesModal(null)}
        >
          <Card
            className="w-full max-w-md p-5 shadow-2xl animate-slide-up"
            hover={false}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 truncate pr-8">
              {notesModal.job_title}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">{notesModal.company_name}</p>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
              placeholder="Interview prep, recruiter name, next steps..."
            />
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Follow-up date
            </label>
            <input
              type="date"
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] mb-5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setNotesModal(null)}>
                Cancel
              </Button>
              <Button
                loading={notesMutation.isPending}
                onClick={() =>
                  notesMutation.mutate({
                    id: notesModal.id,
                    notes: notesDraft,
                    follow_up_date: followUpDraft,
                  })
                }
              >
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, iconColor, bgIcon }: {
  label: string; value: number; icon: typeof Briefcase; color: string; iconColor: string; bgIcon: string
}) {
  return (
    <Card className="animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgIcon}`}>
          <Icon size={14} className={iconColor} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </Card>
  )
}

function OnboardingStep({ step, icon: Icon, title, desc, link }: {
  step: number; icon: typeof Rocket; title: string; desc: string; link: string
}) {
  return (
    <Link
      to={link}
      className="flex items-start gap-3 glass rounded-xl p-4 hover:border-brand-500/20 transition-all duration-200 group"
    >
      <div className="w-8 h-8 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          <span className="text-brand-400 mr-1">Step {step}.</span> {title}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
    </Link>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
