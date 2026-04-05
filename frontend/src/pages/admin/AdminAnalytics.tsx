import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

function MiniChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div className={`w-full rounded-sm ${color} transition-all hover:opacity-80`}
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%`, minHeight: '2px' }} />
          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
            <div className="bg-[var(--surface-3)] text-[var(--text-primary)] text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap border border-[var(--border)]">
              {d.date}: {d.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PlatformBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1
  const colors: Record<string, string> = {
    linkedin: 'bg-blue-500', indeed: 'bg-purple-500', naukri: 'bg-green-500', internshala: 'bg-amber-500'
  }
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([platform, count]) => (
        <div key={platform}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[var(--text-muted)] capitalize font-medium">{platform}</span>
            <span className="text-[var(--text-primary)] font-bold">{count.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colors[platform] || 'bg-brand-500'} transition-all duration-700`}
              style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusGrid({ data }: { data: Record<string, number> }) {
  const colors: Record<string, string> = {
    applied: 'text-blue-500 bg-blue-500/10',
    viewed: 'text-cyan-500 bg-cyan-500/10',
    interview: 'text-green-500 bg-green-500/10',
    rejected: 'text-red-500 bg-red-500/10',
    manual_apply_needed: 'text-amber-500 bg-amber-500/10',
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {Object.entries(data).map(([status, count]) => (
        <div key={status} className={`rounded-xl p-4 ${colors[status] || 'text-[var(--text-muted)] bg-[var(--surface-2)]'}`}>
          <p className="text-2xl font-bold">{count.toLocaleString()}</p>
          <p className="text-xs capitalize mt-1 opacity-80">{status.replace(/_/g, ' ')}</p>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: api.getAdminAnalytics,
    refetchInterval: 60000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-[var(--text-muted)] animate-pulse text-lg">Loading analytics...</div>

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Global Analytics</h1>
        <p className="text-[var(--text-muted)] mt-1">Platform-wide application patterns and system health trends</p>
      </div>

      {/* Status Distribution */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Application Status Distribution</h2>
        {data?.by_status && <StatusGrid data={data.by_status} />}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Applications Chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Daily Applications (30 days)</h3>
          {data?.daily_applications && <MiniChart data={data.daily_applications} color="bg-brand-500" />}
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-2">
            <span>{data?.daily_applications?.[0]?.date}</span>
            <span>{data?.daily_applications?.[data.daily_applications.length - 1]?.date}</span>
          </div>
        </div>

        {/* User Registration Trend */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">User Registrations (30 days)</h3>
          {data?.registration_trend && <MiniChart data={data.registration_trend} color="bg-emerald-500" />}
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-2">
            <span>{data?.registration_trend?.[0]?.date}</span>
            <span>{data?.registration_trend?.[data.registration_trend.length - 1]?.date}</span>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Applications By Platform</h3>
          {data?.by_platform && <PlatformBar data={data.by_platform} />}
        </div>

        {/* Error Trend */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Error Trend (7 days)</h3>
          {data?.error_trend && <MiniChart data={data.error_trend} color="bg-red-500" />}
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-2">
            <span>{data?.error_trend?.[0]?.date}</span>
            <span>{data?.error_trend?.[data.error_trend.length - 1]?.date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
