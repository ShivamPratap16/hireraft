import { useMemo, useRef, useState } from 'react'
import { Hash, X } from 'lucide-react'
import { SUGGESTED_KEYWORDS } from '../data/suggestedKeywords'

function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinKeywords(tokens: string[]): string {
  return tokens.join(', ')
}

interface KeywordTagFieldProps {
  value: string
  onChange: (next: string) => void
  helper?: string
}

export default function KeywordTagField({ value, onChange, helper }: KeywordTagFieldProps) {
  const tokens = useMemo(() => parseKeywords(value), [value])
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = (next: string[]) => {
    onChange(joinKeywords(next))
  }

  const addToken = (t: string) => {
    const x = t.trim()
    if (!x || tokens.includes(x)) return
    commit([...tokens, x])
    setDraft('')
  }

  const remove = (t: string) => commit(tokens.filter((k) => k !== t))

  const flushDraft = () => {
    if (draft.trim()) addToken(draft)
  }

  const suggestions = SUGGESTED_KEYWORDS.filter((k) => !tokens.includes(k))

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide flex items-center gap-1.5">
        <Hash size={14} className="text-[var(--text-muted)]" />
        Search keywords
      </label>
      <p className="text-[11px] text-[var(--text-muted)] -mt-0.5">
        Skills and terms to match in job descriptions. Each chip is sent to the bot; use a few focused terms.
      </p>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] shrink-0">Suggestions</span>
          {suggestions.map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addToken(k)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]
                hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
            >
              + {k}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap gap-1.5 min-h-[44px] bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 transition-all cursor-text
          focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]/50"
        onClick={() => inputRef.current?.focus()}
      >
        {tokens.map((k) => (
          <span
            key={k}
            className="flex items-center gap-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg px-2.5 py-1 text-xs font-medium max-w-full"
          >
            <span className="truncate">{k}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(k)
              }}
              className="hover:text-white transition-colors shrink-0"
              aria-label={`Remove ${k}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              flushDraft()
            }
            if (e.key === 'Backspace' && !draft && tokens.length > 0) {
              remove(tokens[tokens.length - 1])
            }
          }}
          onBlur={() => flushDraft()}
          placeholder={tokens.length === 0 ? 'Type a keyword, Enter or comma to add…' : 'Add another…'}
          className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>

      {helper && <p className="text-[11px] text-[var(--text-muted)]">{helper}</p>}
    </div>
  )
}
