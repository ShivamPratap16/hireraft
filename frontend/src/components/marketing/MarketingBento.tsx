import { Link } from 'react-router-dom'
import { LayoutDashboard, Bot, BarChart3, Zap, Globe } from 'lucide-react'
import { buttonLinkClass } from '../ui/Button'

export default function MarketingBento() {
  return (
    <section id="features" className="py-20 scroll-mt-16 border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] text-center mb-4">
          One platform, full visibility
        </h2>
        <p className="text-center text-[var(--text-secondary)] max-w-2xl mx-auto mb-12 sm:mb-14">
          Everything you need to run multi-board applications—from matching rules to run logs—without tab fatigue.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-5 auto-rows-[minmax(140px,auto)]">
          <div className="md:col-span-4 md:row-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-6 sm:p-8 flex flex-col justify-between min-h-[280px] overflow-hidden relative group hover:border-brand-500/25 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="inline-flex p-2 rounded-xl bg-brand-500/10 text-brand-400 mb-4">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">Command center dashboard</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
                Stats, trends, and application health at a glance. Know what&apos;s applied, viewed, and where follow-ups
                are due.
              </p>
            </div>
            <div className="relative mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4 h-36 flex items-end gap-1">
              {[35, 55, 40, 70, 50, 85, 60, 75].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-brand-600/30 to-brand-400/60 min-w-[4px] group-hover:opacity-90 transition-opacity"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-6 hover:border-brand-500/25 transition-colors">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 w-fit mb-3">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Four platforms</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              Naukri, LinkedIn, Indeed, Internshala—per-platform credentials, limits, and toggles.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Naukri', 'LinkedIn', 'Indeed', 'Internshala'].map((p) => (
                <span
                  key={p}
                  className="text-[10px] px-2 py-1 rounded-md bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-6 hover:border-brand-500/25 transition-colors">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 w-fit mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Smart matching</h3>
            <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
              Keywords, roles, and locations drive what gets queued—so you stay on-strategy.
            </p>
          </div>

          <div className="md:col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/90 p-6 hover:border-brand-500/25 transition-colors">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 w-fit mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Logs you can trust</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
              Every run leaves a trail. Debug faster when something needs a manual touch.
            </p>
          </div>

          <div className="md:col-span-3 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-brand-600/10 via-[var(--surface-2)] to-[var(--surface-2)] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-3">
              <Globe className="w-8 h-8 text-brand-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Daily schedule</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">Pick a run time and let HireRaft handle the rest.</p>
              </div>
            </div>
            <Link to="/register" className={buttonLinkClass('primary', 'md', 'shrink-0 self-start sm:self-center')}>
              Start free
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
