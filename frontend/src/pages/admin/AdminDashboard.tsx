import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Users, FileText, Activity, AlertTriangle, TrendingUp, Zap, CheckCircle } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number | string; color: string; sub?: string
}) {
  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: api.getAdminStats,
    refetchInterval: 15000
  })

  const { data: activity } = useQuery({
    queryKey: ['adminActivityPreview'],
    queryFn: () => api.getAdminActivity(8),
    refetchInterval: 10000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-500 animate-pulse text-lg">Loading platform metrics...</div>

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Overview</h1>
        <p className="text-slate-500 mt-1">Real-time metrics across all HireRaft users</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0} color="bg-brand-500/20 text-brand-400" />
        <StatCard icon={FileText} label="Applications" value={stats?.total_applications ?? 0} color="bg-blue-500/20 text-blue-400" />
        <StatCard icon={CheckCircle} label="Bot Runs" value={stats?.total_runs ?? 0} color="bg-green-500/20 text-green-400" />
        <StatCard icon={Activity} label="Active (7d)" value={stats?.active_users_7d ?? 0} color="bg-purple-500/20 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Zap} label="Apps Today" value={stats?.apps_today ?? 0} color="bg-amber-500/20 text-amber-400" />
        <StatCard icon={TrendingUp} label="Apps This Week" value={stats?.apps_this_week ?? 0} color="bg-cyan-500/20 text-cyan-400" />
        <StatCard icon={AlertTriangle} label="Total Errors" value={stats?.total_errors ?? 0} color="bg-red-500/20 text-red-400" />
      </div>

      {/* Live Activity Preview */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Live Activity Feed</h2>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        </div>
        <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
          {activity?.items?.length ? activity.items.map((e: any) => (
            <div key={e.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                e.level === 'error' ? 'bg-red-500' : e.level === 'warn' ? 'bg-amber-500' : 'bg-green-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{e.message}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{e.platform} · user:{e.user_id?.slice(-6)}</p>
              </div>
              <span className="text-[10px] text-slate-600 tabular-nums flex-shrink-0">
                {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          )) : (
            <div className="px-6 py-12 text-center text-slate-600">No activity yet. Bot runs will appear here in real-time.</div>
          )}
        </div>
      </div>
    </div>
  )
}
