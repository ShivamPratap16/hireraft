import { useRef, useEffect, useState } from 'react'
import { useWebSocket, type LogMessage } from '../hooks/useWebSocket'
import { useQuery } from '@tanstack/react-query'
import { api, type BotRunRow, type RunDetail, type RunLog } from '../lib/api'
import { Badge, Card, EmptyState, Button, platformVariant } from '../components/ui'
import Skeleton from '../components/ui/Skeleton'
import { Trash2, Terminal, ArrowDown, Filter, History, ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
}

const LEVEL_LABELS: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR',
}

const PLATFORM_FILTERS = ['all', 'naukri', 'linkedin', 'indeed', 'internshala', 'system']
const LEVEL_FILTERS = ['all', 'info', 'warn', 'error']

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  internshala: 'Internshala',
}

type Tab = 'live' | 'runs'

export default function Logs() {
  const [tab, setTab] = useState<Tab>('live')

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Activity & runs</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Live log stream and structured run history</p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] p-0.5 bg-[var(--surface-2)]">
          <button
            type="button"
            onClick={() => setTab('live')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === 'live'
                ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Live feed
          </button>
          <button
            type="button"
            onClick={() => setTab('runs')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              tab === 'runs'
                ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <History size={14} />
            Run history
          </button>
        </div>
      </div>

      {tab === 'live' ? <LiveLogsTab /> : <RunHistoryTab />}
    </div>
  )
}

function LiveLogsTab() {
  const { messages: live, connected, clear } = useWebSocket('/ws/logs')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  /** After Clear, do not fall back to REST history (that was making the list reappear). */
  const [useServerHistoryFallback, setUseServerHistoryFallback] = useState(true)

  const { data: history } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.getLogs({ limit: 200 }),
  })

  const handleClear = () => {
    clear()
    setUseServerHistoryFallback(false)
  }

  const allLogs =
    live.length > 0 || !useServerHistoryFallback ? live : (history ?? [])

  const filteredLogs = allLogs.filter((log) => {
    if (platformFilter !== 'all') {
      const plat = log.platform || 'system'
      if (plat !== platformFilter) return false
    }
    if (levelFilter !== 'all' && log.level !== levelFilter) return false
    return true
  })

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [filteredLogs.length, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60)
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      setAutoScroll(true)
    }
  }

  const infos = allLogs.filter((l) => l.level === 'info').length
  const warns = allLogs.filter((l) => l.level === 'warn').length
  const errors = allLogs.filter((l) => l.level === 'error').length

  return (
    <>
      <div className="flex items-center justify-end animate-slide-up">
        <div className="flex items-center gap-3">
          <Badge variant={connected ? 'success' : 'muted'} dot>
            {connected ? 'Live' : 'Offline'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleClear} icon={<Trash2 size={12} />}>
            Clear
          </Button>
        </div>
      </div>

      {allLogs.length > 0 && (
        <div className="flex gap-5 text-xs font-medium animate-fade-in">
          <span className="text-[var(--text-muted)]">{allLogs.length} total</span>
          <span className="text-blue-400">{infos} info</span>
          <span className="text-amber-400">{warns} warn</span>
          <span className="text-red-400">{errors} error</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5 items-center animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <Filter size={14} className="text-[var(--text-muted)]" />
        <div className="flex gap-1">
          {PLATFORM_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                platformFilter === p
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:bg-[var(--surface-3)]'
              }`}
            >
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-[var(--surface-4)]">|</span>
        <div className="flex gap-1">
          {LEVEL_FILTERS.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                levelFilter === l
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:bg-[var(--surface-3)]'
              }`}
            >
              {l === 'all' ? 'All Levels' : LEVEL_LABELS[l] ?? l}
            </button>
          ))}
        </div>
      </div>

      <Card padding="sm" className="overflow-hidden relative animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-amber-500/60" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <div className="flex items-center gap-1.5 ml-3 text-[var(--text-muted)]">
            <Terminal size={12} />
            <span className="text-xs font-medium">hireraft-logs</span>
          </div>
          {connected && (
            <span className="ml-auto relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto font-mono text-xs bg-[var(--surface-0)]/50"
        >
          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<Terminal className="w-8 h-8" />}
              title={allLogs.length > 0 ? 'No matching logs' : 'No logs yet'}
              description={allLogs.length > 0 ? 'Adjust filters to see more' : 'Trigger a run to see activity here'}
            />
          ) : (
            filteredLogs.map((log, i) => <LogRow key={`${log.run_id}-${i}`} log={log} index={i} />)
          )}
        </div>

        {!autoScroll && filteredLogs.length > 10 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2
              bg-gradient-to-r from-brand-500 to-brand-700 rounded-full text-xs font-medium text-white
              shadow-lg hover:shadow-xl transition-all btn-lift animate-slide-up"
          >
            <ArrowDown size={12} />
            Latest
          </button>
        )}
      </Card>
    </>
  )
}

function LogRow({ log, index }: { log: LogMessage | RunLog; index: number }) {
  const ts = log.timestamp
    ? format(new Date(log.timestamp), 'HH:mm:ss')
    : '--:--:--'

  const levelDot: Record<string, string> = {
    info: 'bg-blue-400',
    warn: 'bg-amber-400',
    error: 'bg-red-400',
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-2 border-b border-[var(--border)]/30 transition-colors group
        hover:bg-[var(--surface-2)]/30
        ${log.level === 'error' ? 'bg-red-500/3' : ''}
        ${index < 20 ? 'animate-fade-in' : ''}`}
      style={index < 20 ? { animationDelay: `${index * 0.02}s` } : undefined}
    >
      <span className="text-[var(--text-muted)] shrink-0 w-16 tabular-nums select-none">{ts}</span>
      <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${levelDot[log.level] ?? 'bg-gray-600'}`} />
      <span className={`shrink-0 w-10 text-[10px] font-bold tracking-widest mt-0.5 ${LEVEL_COLORS[log.level] ?? 'text-[var(--text-muted)]'}`}>
        {LEVEL_LABELS[log.level] ?? log.level.toUpperCase()}
      </span>
      <span className="text-[var(--text-muted)] shrink-0 w-20 truncate text-[11px]">{log.platform || 'system'}</span>
      <span className={`flex-1 break-all leading-relaxed ${
        log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-[var(--text-secondary)]'
      }`}>
        {log.message}
      </span>
    </div>
  )
}

function statusBadgeVariant(status: string): 'success' | 'muted' | 'danger' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  return 'muted'
}

function RunHistoryTab() {
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['runs', page],
    queryFn: () => api.getRuns({ page, page_size: 15 }),
  })

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ['runDetail', expandedId],
    queryFn: () => api.getRunDetail(expandedId!),
    enabled: !!expandedId,
  })

  const toggleExpand = (runId: string) => {
    setExpandedId((id) => (id === runId ? null : runId))
  }

  const items = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1

  return (
    <div className="space-y-4 animate-slide-up">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} hover={false}>
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState
          icon={<History className="w-8 h-8" />}
          title="No runs yet"
          description="Start a bot run from the dashboard to see history here"
        />
      ) : (
        items.map((row) => (
          <RunHistoryCard
            key={`${row.run_id}-${row.id}`}
            row={row}
            expanded={expandedId === row.run_id}
            onToggle={() => toggleExpand(row.run_id)}
            detail={expandedId === row.run_id ? detail : undefined}
            detailLoading={expandedId === row.run_id && detailLoading}
          />
        ))
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--text-muted)]">
            Page {data.page} of {totalPages} ({data.total} runs)
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RunHistoryCard({
  row,
  expanded,
  onToggle,
  detail,
  detailLoading,
}: {
  row: BotRunRow
  expanded: boolean
  onToggle: () => void
  detail?: RunDetail
  detailLoading?: boolean
}) {
  const started = row.started_at ? format(new Date(row.started_at), 'MMM d, yyyy HH:mm') : '—'
  const finished = row.finished_at ? format(new Date(row.finished_at), 'HH:mm:ss') : '—'
  const plat = PLATFORM_LABELS[row.platform] ?? row.platform

  return (
    <Card hover={false} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)]/40 transition-colors"
      >
        <span className="mt-0.5 text-[var(--text-muted)]">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={platformVariant(row.platform)} dot>
              {plat}
            </Badge>
            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
            <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">{row.run_id}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
            {started}
            {row.finished_at && ` → ${finished}`}
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="text-[var(--text-muted)]">
              Found: <strong className="text-[var(--text-primary)]">{row.jobs_found}</strong>
            </span>
            <span className="text-[var(--text-muted)]">
              Applied: <strong className="text-emerald-400">{row.jobs_applied}</strong>
            </span>
            <span className="text-[var(--text-muted)]">
              Skipped: <strong className="text-amber-400">{row.jobs_skipped}</strong>
            </span>
            {row.error_count > 0 && (
              <span className="text-[var(--text-muted)]">
                Errors: <strong className="text-red-400">{row.error_count}</strong>
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-0)]/40">
          {detailLoading && <Skeleton className="h-24 w-full" />}
          {!detailLoading && detail && (
            <div className="space-y-3">
              {detail.platforms.length > 1 && (
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Platforms in this run</p>
              )}
              {detail.platforms.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {detail.platforms.map((p) => (
                    <Badge key={p.id} variant={platformVariant(p.platform)} className="text-[10px]">
                      {PLATFORM_LABELS[p.platform] ?? p.platform}: {p.status}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Logs</p>
              <div className="max-h-56 overflow-y-auto font-mono text-[11px] rounded-lg border border-[var(--border)] bg-[var(--surface-0)]">
                {detail.logs.length === 0 ? (
                  <p className="p-3 text-[var(--text-muted)]">No log lines stored for this run</p>
                ) : (
                  detail.logs.map((log, i) => (
                    <div key={log.id ?? i} className="px-2 py-1 border-b border-[var(--border)]/30 flex gap-2">
                      <span className="text-[var(--text-muted)] shrink-0 w-14">
                        {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : ''}
                      </span>
                      <span className="text-[var(--text-muted)] shrink-0 w-16">{log.platform}</span>
                      <span className={LEVEL_COLORS[log.level] ?? ''}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
