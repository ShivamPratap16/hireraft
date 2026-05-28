import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type MatchFeedItem } from '../lib/api'
import { format } from 'date-fns'

const STATE_TABS: Array<{ key: string; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'applied', label: 'Applied' },
  { key: 'failed', label: 'Failed' },
  { key: 'dismissed', label: 'Dismissed' },
]

export default function Discovery() {
  const qc = useQueryClient()
  const [activeState, setActiveState] = useState<string>('pending')

  const { data: feed, isLoading } = useQuery({
    queryKey: ['discovery-feed', activeState],
    queryFn: () => api.getDiscoveryFeed(activeState),
    refetchOnWindowFocus: true,
  })

  const { data: stats } = useQuery({
    queryKey: ['discovery-stats'],
    queryFn: api.getDiscoveryStats,
  })

  const applyMut = useMutation({
    mutationFn: (id: string) => api.applyMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-feed'] })
      qc.invalidateQueries({ queryKey: ['discovery-stats'] })
    },
  })

  const dismissMut = useMutation({
    mutationFn: (id: string) => api.dismissMatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-feed'] })
      qc.invalidateQueries({ queryKey: ['discovery-stats'] })
    },
  })

  const rematchMut = useMutation({
    mutationFn: api.rematch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery-feed'] }),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Discovery</h1>
          {stats && (
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {stats.total_matches} total · {stats.applied} applied · {stats.pending_notify} pending · {stats.failed} failed
            </p>
          )}
        </div>
        <button
          onClick={() => rematchMut.mutate()}
          disabled={rematchMut.isPending}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm disabled:opacity-50"
        >
          {rematchMut.isPending ? 'Rematching…' : 'Rematch all open jobs'}
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-[var(--border)]">
        {STATE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveState(t.key)}
            className={`px-4 py-2 text-sm border-b-2 ${
              activeState === t.key
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-[var(--text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && (!feed || feed.length === 0) && (
        <p className="text-[var(--text-muted)] text-center py-12">No matches in this bucket yet.</p>
      )}
      <div className="space-y-3">
        {feed?.map((m: MatchFeedItem) => (
          <div key={m.id} className="border border-[var(--border)] rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1">
              <a
                href={m.job_url}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-medium hover:underline"
              >
                {m.job_title}
              </a>
              <p className="text-sm text-[var(--text-muted)]">
                {m.company_name} · {m.location || '—'} · {m.ats}
              </p>
              <p className="text-xs mt-2">
                <span className="font-semibold">Score:</span> {m.score.toFixed(2)} ·{' '}
                <span className="font-semibold">Matched:</span> {m.matched_terms.slice(0, 5).join(', ') || '—'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {format(new Date(m.created_at), 'MMM d, HH:mm')}
                {m.applied_at && ` · Applied: ${format(new Date(m.applied_at), 'MMM d, HH:mm')}`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                  m.decision === 'auto_apply' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {m.decision}
              </span>
              {(m.state === 'pending' || m.state === 'failed') && (
                <button
                  onClick={() => applyMut.mutate(m.id)}
                  disabled={applyMut.isPending}
                  className="px-3 py-1 text-xs rounded bg-brand-500 text-white disabled:opacity-50"
                >
                  {m.state === 'failed' ? 'Retry' : 'Apply'}
                </button>
              )}
              {m.state !== 'applied' && m.state !== 'dismissed' && (
                <button
                  onClick={() => dismissMut.mutate(m.id)}
                  className="px-3 py-1 text-xs rounded border border-[var(--border)] text-[var(--text-muted)]"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
