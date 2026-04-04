import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type AdminUserRow } from '../../lib/api'
import { format } from 'date-fns'
import { ShieldAlert, Trash2, Eye, Search, ChevronDown, X, Lock, Key, Globe, Briefcase, ScrollText, Ban } from 'lucide-react'

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['adminUserDetail', userId],
    queryFn: () => api.getAdminUserDetail(userId),
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="text-white animate-pulse text-lg">Loading user data...</div>
    </div>
  )

  const u = data?.user
  const p = data?.profile || {}

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl mx-4 mb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">{u?.name || 'Unknown'}</h2>
            <p className="text-sm text-slate-500">{u?.email}</p>
            <p className="text-[10px] mt-1 text-slate-600 font-mono">{u?.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Credentials */}
          <section>
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Key size={14} /> Credentials & Auth</h3>
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Hashed Password</span><span className="text-slate-300 break-all max-w-[70%] text-right">{u?.hashed_password}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Role</span><span className={`font-bold ${u?.role === 'admin' ? 'text-red-400' : 'text-slate-300'}`}>{u?.role}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Registered</span><span className="text-slate-300">{u?.created_at ? format(new Date(u.created_at), 'PPpp') : '-'}</span></div>
              <div className="pt-3 mt-2 border-t border-slate-700 font-sans">
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-2">Reset Login Password</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-brand-500 focus:outline-none" />
                  <button
                    onClick={async () => {
                      if (!newPw.trim() || newPw.length < 4) { setPwMsg('Min 4 chars'); return }
                      try {
                        await api.resetAdminUserPassword(userId, newPw)
                        setPwMsg('Password reset! ✓')
                        setNewPw('')
                        qc.invalidateQueries({ queryKey: ['adminUserDetail', userId] })
                      } catch { setPwMsg('Failed') }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-colors">
                    Reset
                  </button>
                </div>
                {pwMsg && <p className="text-[10px] mt-1 text-amber-300">{pwMsg}</p>}
              </div>
            </div>
          </section>

          {/* Platform Credentials (Decrypted) */}
          <section>
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Lock size={14} /> Platform Credentials (Decrypted)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data?.platform_settings?.map((ps: any) => (
                <div key={ps.platform} className="bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white capitalize">{ps.platform}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ps.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                      {ps.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between"><span className="text-slate-500">Username</span><span className="text-slate-300">{ps.username || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Password</span><span className="text-amber-300">{ps.password_decrypted || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Daily Limit</span><span className="text-slate-300">{ps.daily_limit}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Keywords</span><span className="text-slate-300 truncate max-w-[60%]">{ps.keywords || '—'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Profile */}
          {p.full_name && (
            <section>
              <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Globe size={14} /> Profile</h3>
              <div className="bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-2 text-xs">
                {['full_name','headline','phone','location','skills','education','experience','linkedin_url','github_url'].map(k => (
                  p[k] ? <div key={k}><span className="text-slate-500 capitalize">{k.replace(/_/g,' ')}</span><p className="text-slate-300 mt-0.5 break-words">{p[k]}</p></div> : null
                ))}
              </div>
            </section>
          )}

          {/* Applications */}
          <section>
            <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Briefcase size={14} /> Applications ({data?.stats?.app_count})</h3>
            {data?.applications?.length ? (
              <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-slate-500">
                    <tr><th className="px-4 py-2 text-left">Job</th><th className="px-4 py-2">Platform</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.applications.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate">{a.job_title} <span className="text-slate-600">@ {a.company_name}</span></td>
                        <td className="px-4 py-2 text-center capitalize text-slate-400">{a.platform}</td>
                        <td className="px-4 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === 'applied' ? 'bg-blue-500/20 text-blue-400' :
                          a.status === 'interview' ? 'bg-green-500/20 text-green-400' :
                          a.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                        }`}>{a.status}</span></td>
                        <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{a.applied_at ? format(new Date(a.applied_at), 'MMM dd') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-slate-600 text-sm">No applications yet</p>}
          </section>

          {/* Logs */}
          <section>
            <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2"><ScrollText size={14} /> Recent Logs ({data?.logs?.length})</h3>
            <div className="bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-800/30">
              {data?.logs?.length ? data.logs.map((l: any) => (
                <div key={l.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.level === 'error' ? 'bg-red-500' : l.level === 'warn' ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <span className="text-slate-300 flex-1 truncate">{l.message}</span>
                  <span className="text-slate-600 tabular-nums flex-shrink-0">{l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''}</span>
                </div>
              )) : <p className="text-slate-600 text-sm px-4 py-6 text-center">No logs</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}


export default function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', search],
    queryFn: () => api.getAdminUsers(0, 100, search),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.updateAdminUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  })

  const blockMutation = useMutation({
    mutationFn: (id: string) => api.toggleBlockUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {selectedUser && <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-slate-500 mt-1">Inspect, control, and manage all platform users</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none transition-colors w-64" />
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Fetching accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-800/50 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold text-center">Apps</th>
                  <th className="px-6 py-4 font-semibold text-center">Runs</th>
                  <th className="px-6 py-4 font-semibold">Registered</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data?.items?.map((u: AdminUserRow) => (
                  <tr key={u.id} className={`hover:bg-slate-800/30 transition-colors group ${u.is_blocked ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{u.name || 'Anonymous'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                        {u.is_blocked && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">Blocked</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                          <ShieldAlert size={10} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-300 font-medium">{u.app_count}</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-300 font-medium">{u.run_count}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{u.created_at ? format(new Date(u.created_at), 'MMM dd, yyyy') : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setSelectedUser(u.id)} title="Inspect user"
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => blockMutation.mutate(u.id)}
                          title={u.is_blocked ? 'Unblock user' : 'Block user'}
                          className={`p-2 rounded-lg transition-colors ${u.is_blocked ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'}`}>
                          <Ban size={14} />
                        </button>
                        <button
                          onClick={() => roleMutation.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}
                          title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                          className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
                          <ChevronDown size={14} className={u.role === 'admin' ? 'rotate-0' : 'rotate-180'} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete user ${u.email}? This removes ALL their data permanently.`)) deleteMutation.mutate(u.id) }}
                          title="Delete user & all data"
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.items?.length && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-600">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data?.total != null && (
          <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-600">
            {data.total} total user{data.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
