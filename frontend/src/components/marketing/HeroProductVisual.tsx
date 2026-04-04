import { useState } from 'react'

/** CSS fallback when /marketing/dashboard-preview.png is missing */
function DashboardPlaceholder() {
  return (
    <div className="p-4 sm:p-6 space-y-4 bg-[var(--surface-1)] min-h-[220px] sm:min-h-[280px]">
      <div className="flex flex-wrap gap-2">
        {['Total', 'Applied', 'Interview'].map((label, i) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left min-w-[100px]"
          >
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{[128, 42, 6][i]}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 h-28 flex items-end gap-1">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-brand-600/40 to-brand-400/70 min-w-[6px]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        {['Senior Engineer · Applied', 'Product Analyst · Viewed'].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]/80"
          >
            <span className="text-[var(--text-secondary)] truncate">{row}</span>
            <span className="text-brand-400 shrink-0 ml-2">●</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HeroProductVisual() {
  const [useImage, setUseImage] = useState(true)

  return (
    <div
      className="relative rounded-xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-lg)] bg-[var(--surface-2)]
        ring-1 ring-[var(--border)]/50"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)]/40">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" aria-hidden />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" aria-hidden />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" aria-hidden />
        <span className="ml-2 text-[10px] text-[var(--text-muted)] truncate flex-1 text-center sm:text-left font-mono">
          app.hireraft.com · Dashboard
        </span>
      </div>
      <div className="relative">
        {useImage ? (
          <img
            src="/marketing/dashboard-preview.png"
            alt="HireRaft dashboard showing application stats and activity"
            className="w-full h-auto object-cover object-top max-h-[340px] sm:max-h-[400px]"
            width={1200}
            height={760}
            decoding="async"
            loading="eager"
            onError={() => setUseImage(false)}
          />
        ) : (
          <DashboardPlaceholder />
        )}
      </div>
    </div>
  )
}
