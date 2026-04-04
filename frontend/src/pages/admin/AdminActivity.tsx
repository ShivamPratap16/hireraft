import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export default function AdminActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ['adminActivity'],
    queryFn: () => api.getAdminActivity(200),
    refetchInterval: 5000,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Activity Feed</h1>
          <p className="text-slate-500 mt-1">Real-time global log stream across all users</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" /></span>
          <span className="text-xs text-green-400 font-semibold">LIVE</span>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Streaming activity...</div>
        ) : (
          <div className="divide-y divide-slate-800/30 max-h-[75vh] overflow-y-auto">
            {data?.items?.length ? data.items.map((e: any) => (
              <div key={e.id} className="px-6 py-3.5 flex items-start gap-4 hover:bg-slate-800/20 transition-colors">
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  e.level === 'error' ? 'bg-red-500 shadow-red-500/50 shadow-sm' :
                  e.level === 'warn' ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{e.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{e.platform}</span>
                    <span className="text-[10px] text-slate-600">user: ...{e.user_id?.slice(-8)}</span>
                    <span className="text-[10px] text-slate-600">run: {e.run_id}</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-600 tabular-nums flex-shrink-0 mt-0.5">
                  {e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}
                </span>
              </div>
            )) : (
              <div className="px-6 py-16 text-center text-slate-600">
                <p className="text-lg mb-2">No activity yet</p>
                <p className="text-sm">Bot runs and system events will appear in real-time</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
