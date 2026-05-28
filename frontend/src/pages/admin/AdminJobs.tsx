import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type JobRead } from '../../lib/api'
import { format } from 'date-fns'

export default function AdminJobs() {
  const [q, setQ] = useState('')
  const [ats, setAts] = useState('')
  const [status, setStatus] = useState('active')
  const [companySlug, setCompanySlug] = useState('')
  const [region, setRegion] = useState<'' | 'india' | 'foreign'>('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', q, ats, status, companySlug, region, page],
    queryFn: () =>
      api.listJobs({
        q: q || undefined,
        ats: ats || undefined,
        status: status || undefined,
        company_slug: companySlug || undefined,
        region: region || undefined,
        page,
        page_size: pageSize,
      }),
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {data ? `${data.total.toLocaleString()} job${data.total === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <div className="mb-4 flex gap-1 items-center text-xs">
        {([
          { key: '', label: 'All regions' },
          { key: 'india', label: 'India' },
          { key: 'foreign', label: 'Foreign' },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => { setRegion(opt.key); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              region === opt.key
                ? 'bg-brand-500 text-white'
                : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="border border-[var(--border)] rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold mb-1">Search title</label>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="e.g. backend engineer"
            className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ATS</label>
          <select
            value={ats}
            onChange={(e) => { setAts(e.target.value); setPage(1) }}
            className="px-2 py-1.5 rounded border border-[var(--border)] bg-transparent text-sm"
          >
            <option value="">all</option>
            <option value="greenhouse">greenhouse</option>
            <option value="lever">lever</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-2 py-1.5 rounded border border-[var(--border)] bg-transparent text-sm"
          >
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="">all</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Company slug</label>
          <input
            value={companySlug}
            onChange={(e) => { setCompanySlug(e.target.value); setPage(1) }}
            placeholder="e.g. stripe"
            className="px-2 py-1.5 rounded border border-[var(--border)] bg-transparent text-sm w-32"
          />
        </div>
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && data && data.items.length === 0 && (
        <p className="text-[var(--text-muted)] text-center py-12">No jobs match these filters.</p>
      )}

      <div className="space-y-2">
        {data?.items.map((j: JobRead) => (
          <div key={j.id} className="border border-[var(--border)] rounded-xl p-3 hover:bg-[var(--surface-2)]/40 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <a
                  href={j.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {j.title}
                </a>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {j.company_name} · {j.location || '—'} · <span className="font-mono">{j.ats}/{j.company_slug}</span>
                </p>
                {j.description_preview && (
                  <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2">{j.description_preview}…</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    j.status === 'active'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {j.status}
                </span>
                <p className="text-[10px] text-[var(--text-muted)] mt-1 tabular-nums">
                  seen: {format(new Date(j.last_seen_at), 'MMM d HH:mm')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-sm text-[var(--text-muted)] tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
