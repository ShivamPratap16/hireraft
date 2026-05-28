import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type CompanyRead } from '../../lib/api'
import { format } from 'date-fns'

export default function AdminCompanies() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [ats, setAts] = useState<'greenhouse' | 'lever'>('greenhouse')
  const [slug, setSlug] = useState('')

  const { data: companies, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.listCompanies(),
  })

  const createMut = useMutation({
    mutationFn: () => api.createCompany({ name, ats, slug }),
    onSuccess: () => {
      setName(''); setSlug('')
      qc.invalidateQueries({ queryKey: ['admin-companies'] })
    },
  })

  const toggleMut = useMutation({
    mutationFn: (c: CompanyRead) => api.updateCompany(c.id, { active: !c.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCompany(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const seedMut = useMutation({
    mutationFn: api.seedCompanies,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  })

  const syncMut = useMutation({
    mutationFn: api.triggerDiscoverySync,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Companies</h1>
        <div className="flex gap-2">
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="px-3 py-2 text-sm rounded-xl border border-[var(--border)] disabled:opacity-50"
          >
            {seedMut.isPending ? 'Seeding…' : 'Seed from JSON'}
          </button>
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="px-3 py-2 text-sm rounded-xl bg-brand-500 text-white disabled:opacity-50"
          >
            {syncMut.isPending ? 'Triggering…' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ATS</label>
          <select value={ats} onChange={(e) => setAts(e.target.value as 'greenhouse' | 'lever')} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent">
            <option value="greenhouse">greenhouse</option>
            <option value="lever">lever</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="px-2 py-1 rounded border border-[var(--border)] bg-transparent" placeholder="e.g. swiggy" />
        </div>
        <button
          onClick={() => createMut.mutate()}
          disabled={!name || !slug || createMut.isPending}
          className="px-3 py-2 text-sm rounded-xl bg-brand-500 text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {isLoading && <p>Loading…</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
          <tr>
            <th className="py-2">Name</th>
            <th>ATS</th>
            <th>Slug</th>
            <th>Active</th>
            <th>Last synced</th>
            <th>Error</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {companies?.map((c) => (
            <tr key={c.id} className="border-b border-[var(--border)]/40">
              <td className="py-2">{c.name}</td>
              <td>{c.ats}</td>
              <td className="font-mono text-xs">{c.slug}</td>
              <td>
                <button
                  onClick={() => toggleMut.mutate(c)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    c.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {c.active ? 'active' : 'paused'}
                </button>
              </td>
              <td className="text-xs">
                {c.last_synced_at ? format(new Date(c.last_synced_at), 'MMM d HH:mm') : '—'}
              </td>
              <td className="text-xs text-red-400 max-w-xs truncate">{c.last_sync_error || ''}</td>
              <td>
                <button
                  onClick={() => deleteMut.mutate(c.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
