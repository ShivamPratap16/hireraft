import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, X, ChevronDown } from 'lucide-react'

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span className="text-brand-400 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

export default function RoleMultiSelect({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (roles: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchRoles = useCallback(
    async (query: string) => {
      setLoading(true)
      try {
        const token = localStorage.getItem('jp_token')
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`/api/roles/search?q=${encodeURIComponent(query)}&limit=20`, { headers })
        if (res.ok) {
          const data = await res.json()
          setSuggestions((data.roles as string[]).filter((r: string) => !selected.includes(r)))
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    },
    [selected]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (open) fetchRoles(search)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, open, fetchRoles])

  const addRole = (role: string) => {
    if (!selected.includes(role)) onChange([...selected, role])
    setSearch('')
    setSuggestions((prev) => prev.filter((r) => r !== role))
    inputRef.current?.focus()
  }

  const removeRole = (role: string) => onChange(selected.filter((r) => r !== role))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      addRole(search.trim())
    }
    if (e.key === 'Backspace' && !search && selected.length > 0) removeRole(selected[selected.length - 1])
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide mb-1.5 block">
        Job titles / roles
      </label>
      <p className="text-[11px] text-[var(--text-muted)] mb-2">
        Search the catalog and add titles; combine with keywords for tighter matches.
      </p>
      <div
        className="flex flex-wrap gap-1.5 min-h-[44px] bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 cursor-text
          focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]/50 transition-all"
        onClick={() => {
          inputRef.current?.focus()
          setOpen(true)
        }}
      >
        {selected.map((role) => (
          <span
            key={role}
            className="flex items-center gap-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap animate-slide-up"
          >
            {role}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeRole(role)
              }}
              className="hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="flex-1 flex items-center gap-1.5 min-w-[150px]">
          <Search size={14} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? 'Search roles (e.g. Software Engineer)...' : 'Search more roles...'}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          {loading && <Loader2 size={14} className="animate-spin text-[var(--text-muted)] shrink-0" />}
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="self-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1.5 glass rounded-xl shadow-xl max-h-60 overflow-y-auto border border-[var(--border-hover)] animate-slide-up">
          {suggestions.length > 0 ? (
            suggestions.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => addRole(role)}
                className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-brand-500/10 hover:text-brand-400
                  transition-colors flex items-center gap-2.5 border-b border-[var(--border)]/50 last:border-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0" />
                <HighlightMatch text={role} query={search} />
              </button>
            ))
          ) : loading ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : search.trim() ? (
            <button
              type="button"
              onClick={() => addRole(search.trim())}
              className="w-full text-left px-4 py-2.5 text-sm text-brand-400 hover:bg-brand-500/10 transition-colors"
            >
              + Add custom role &quot;{search.trim()}&quot;
            </button>
          ) : (
            <div className="px-4 py-4 text-sm text-[var(--text-muted)]">
              Start typing — suggestions load from the roles API (thousands of titles when configured).
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          {selected.length} role{selected.length > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
