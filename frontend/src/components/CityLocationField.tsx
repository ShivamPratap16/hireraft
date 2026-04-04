import { useMemo, useRef, useState, useEffect } from 'react'
import { MapPin, X, Plus, Search } from 'lucide-react'
import Input from './ui/Input'
import Select from './ui/Select'
import { Button } from './ui'
import {
  JOB_SEARCH_CITIES,
  JOB_SEARCH_CITY_SET,
  POPULAR_JOB_CITIES,
  parseLocationTokens,
  joinLocationTokens,
} from '../data/cities'

const CUSTOM = '__jp_custom__'

export interface CityLocationFieldProps {
  label?: string
  value: string
  onChange: (next: string) => void
  helper?: string
  /** `multiple` = automation. `single` = profile (dropdown only). */
  mode?: 'single' | 'multiple'
}

/** Profile: native-style dropdown + optional “Other” text field only. */
function ProfileLocationSelect({
  label = 'Location',
  value,
  onChange,
  helper,
}: Pick<CityLocationFieldProps, 'label' | 'value' | 'onChange' | 'helper'>) {
  const trimmed = value.trim()
  const inList = trimmed !== '' && JOB_SEARCH_CITY_SET.has(trimmed)
  const selectValue = trimmed === '' ? '' : inList ? trimmed : CUSTOM

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    if (v === '') {
      onChange('')
      return
    }
    if (v === CUSTOM) {
      if (inList) onChange('')
      return
    }
    onChange(v)
  }

  const options = useMemo(
    () => [
      { value: '', label: 'Select city…' },
      ...JOB_SEARCH_CITIES.map((c) => ({ value: c, label: c })),
      { value: CUSTOM, label: 'Other (type below)' },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-2">
      <Select
        label={label}
        icon={<MapPin size={14} />}
        value={selectValue}
        onChange={handleSelect}
        options={options}
      />
      {selectValue === CUSTOM && (
        <Input
          placeholder="Enter your city or area"
          value={inList ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {helper && <p className="text-[11px] text-[var(--text-muted)]">{helper}</p>}
    </div>
  )
}

function CityLocationFieldMultiple({
  label = 'Locations',
  value,
  onChange,
  helper,
}: CityLocationFieldProps) {
  const selected = useMemo(() => parseLocationTokens(value), [value])
  const [showCustom, setShowCustom] = useState(false)
  const [customDraft, setCustomDraft] = useState('')
  const [query, setQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const available = useMemo(
    () => JOB_SEARCH_CITIES.filter((c) => !selected.includes(c)),
    [selected]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available.slice(0, 28)
    return available.filter((c) => c.toLowerCase().includes(q)).slice(0, 40)
  }, [available, query])

  const popularToShow = useMemo(
    () => POPULAR_JOB_CITIES.filter((c) => !selected.includes(c)),
    [selected]
  )

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const commit = (next: string[]) => {
    onChange(joinLocationTokens(next))
  }

  const remove = (token: string) => {
    commit(selected.filter((s) => s !== token))
  }

  const addPreset = (city: string) => {
    if (!city || selected.includes(city)) return
    commit([...selected, city])
    setQuery('')
    setPanelOpen(false)
  }

  const addCustom = () => {
    const t = customDraft.trim()
    if (!t || selected.includes(t)) return
    commit([...selected, t])
    setCustomDraft('')
    setShowCustom(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide flex items-center gap-1.5">
          <MapPin size={14} className="text-[var(--text-muted)]" />
          {label}
        </label>
      )}
      <p className="text-[11px] text-[var(--text-muted)] -mt-0.5">
        Same pattern as LinkedIn / Indeed: pick metros or search the list. Multiple cities each get their own search run.
      </p>

      {popularToShow.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] shrink-0">Popular</span>
          {popularToShow.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addPreset(c)}
              className="text-[11px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)]
                hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
            >
              + {c}
            </button>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap gap-1.5 min-h-[44px] bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 transition-all
          focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]/50"
      >
        {selected.length === 0 && (
          <span className="text-sm text-[var(--text-muted)] self-center">
            No cities yet — search below or use Popular
          </span>
        )}
        {selected.map((city) => (
          <span
            key={city}
            className="flex items-center gap-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg px-2.5 py-1 text-xs font-medium max-w-full"
          >
            <span className="truncate">{city}</span>
            <button
              type="button"
              onClick={() => remove(city)}
              className="hover:text-white transition-colors shrink-0"
              aria-label={`Remove ${city}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <div
          className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2 transition-all
            focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]/50"
        >
          <Search size={16} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPanelOpen(true)
            }}
            onFocus={() => setPanelOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault()
                const exact = available.find((c) => c.toLowerCase() === query.trim().toLowerCase())
                if (exact) addPreset(exact)
                else if (filtered.length === 1) addPreset(filtered[0])
                else if (!selected.includes(query.trim())) {
                  commit([...selected, query.trim()])
                  setQuery('')
                  setPanelOpen(false)
                }
              }
              if (e.key === 'Escape') setPanelOpen(false)
            }}
            placeholder={
              selected.length > 0 ? 'Search to add another city…' : 'Search cities (type to filter)…'
            }
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>

        {panelOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-52 overflow-y-auto glass rounded-xl shadow-xl border border-[var(--border-hover)] animate-slide-up">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addPreset(c)}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-brand-500/10 hover:text-brand-400
                    border-b border-[var(--border)]/40 last:border-0 transition-colors"
                >
                  {c}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-[var(--text-muted)]">No matches — try another spelling or add custom.</div>
            )}
            {query.trim() && !available.some((c) => c.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const t = query.trim()
                  if (!t || selected.includes(t)) return
                  commit([...selected, t])
                  setQuery('')
                  setPanelOpen(false)
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-brand-400 hover:bg-brand-500/10 border-t border-[var(--border)]/50"
              >
                + Add “{query.trim()}” as custom location
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCustom((s) => !s)}
        className="text-left text-[11px] text-[var(--text-muted)] hover:text-brand-400 transition-colors w-fit"
      >
        {showCustom ? '− Hide custom location form' : '+ Add location with full address (optional)'}
      </button>

      {showCustom && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1">
            <Input
              placeholder="e.g. Indore, or New York, NY"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addCustom} icon={<Plus size={14} />}>
            Add
          </Button>
        </div>
      )}

      {helper && <p className="text-[11px] text-[var(--text-muted)]">{helper}</p>}
    </div>
  )
}

export default function CityLocationField({ mode = 'multiple', ...props }: CityLocationFieldProps) {
  if (mode === 'single') {
    return <ProfileLocationSelect {...props} />
  }
  return <CityLocationFieldMultiple {...props} />
}
