import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PlatformSetting } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { Button, Input, Card, Badge, Select } from '../ui'
import CityLocationField from '../CityLocationField'
import KeywordTagField from '../KeywordTagField'
import { Save, Eye, EyeOff, Briefcase } from 'lucide-react'
import { getPlatformMeta } from './platformMeta'
import { YEARS_OPTIONS, MONTHS_OPTIONS, formatExperience, parseExperience } from './experienceUtils'
import ToggleSwitch from './ToggleSwitch'
import RoleMultiSelect from './RoleMultiSelect'

function PasswordField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Password</label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)] transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 hover:border-[var(--border-hover)]"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

const yearSelectOptions = YEARS_OPTIONS.map((y) => ({
  value: String(y),
  label: `${y} ${y === 1 ? 'year' : 'years'}`,
}))
const monthSelectOptions = MONTHS_OPTIONS.map((m) => ({
  value: String(m),
  label: `${m} ${m === 1 ? 'month' : 'months'}`,
}))

export default function PlatformAutomationCard({ setting }: { setting: PlatformSetting }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ ...setting })
  const exp = parseExperience(form.experience)
  const [expYears, setExpYears] = useState(exp.years)
  const [expMonths, setExpMonths] = useState(exp.months)
  const meta = getPlatformMeta(setting.platform)
  const { Icon } = meta

  const mutation = useMutation({
    mutationFn: (data: Partial<PlatformSetting>) => api.updatePlatformSetting(setting.platform, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platformSettings'] })
      toast('success', `${meta.label} settings saved`)
    },
    onError: () => toast('error', 'Failed to save settings'),
  })

  const toggleEnabled = () => {
    const next = !form.enabled
    setForm({ ...form, enabled: next })
    mutation.mutate({ enabled: next })
  }

  const handleSave = () => {
    mutation.mutate({
      username: form.username,
      password: form.password,
      daily_limit: form.daily_limit,
      keywords: form.keywords,
      role: form.role,
      location: form.location,
      experience: formatExperience(expYears, expMonths),
    })
  }

  const selectedRoles = form.role ? form.role.split(',').map((r) => r.trim()).filter(Boolean) : []
  const setRoles = (roles: string[]) => setForm({ ...form, role: roles.join(', ') })

  return (
    <Card hover={false} className="overflow-hidden !p-0 flex rounded-2xl">
      <div className={`w-1 shrink-0 self-stretch min-h-[120px] ${meta.accentBar}`} aria-hidden />
      <div className="flex-1 min-w-0 p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${meta.bg}`}>
              <Icon size={18} className={meta.color} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-base font-semibold ${meta.color}`}>{meta.label}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Daily cap: {form.daily_limit} application{form.daily_limit === 1 ? '' : 's'} per run
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={form.enabled ? 'success' : 'muted'} dot>
              {form.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <ToggleSwitch checked={form.enabled} onChange={toggleEnabled} />
          </div>
        </div>

        <div className="space-y-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Account</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Username / Email"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <PasswordField value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          </div>

          <div className="border-t border-[var(--border)]/60 pt-5 mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Search &amp; targeting
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-0)]/35 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-500/10 shrink-0">
                  <Briefcase size={16} className="text-brand-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Search &amp; targeting</h4>
                  <p
                    className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed"
                    title="Keywords filter listings; job titles drive the query; each location runs as its own search."
                  >
                    Keywords, titles, and locations shape each search run.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <KeywordTagField value={form.keywords} onChange={(keywords) => setForm({ ...form, keywords })} />
                <CityLocationField
                  value={form.location}
                  onChange={(location) => setForm({ ...form, location })}
                  helper="Stored as a comma-separated list; each city is searched separately."
                />
              </div>
              <RoleMultiSelect selected={selectedRoles} onChange={setRoles} />
            </div>
          </div>

          <div className="border-t border-[var(--border)]/60 pt-5 mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Limits</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] tracking-wide mb-2">Experience</p>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Years"
                    value={String(expYears)}
                    onChange={(e) => setExpYears(Number(e.target.value))}
                    options={yearSelectOptions}
                  />
                  <Select
                    label="Months"
                    value={String(expMonths)}
                    onChange={(e) => setExpMonths(Number(e.target.value))}
                    options={monthSelectOptions}
                  />
                </div>
              </div>
              <Input
                label="Daily limit"
                type="number"
                helper="Max applications per run per day"
                value={String(form.daily_limit)}
                onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--border)]/60 pt-4 mt-5">
          <Button loading={mutation.isPending} onClick={handleSave} icon={<Save size={14} />}>
            Save {meta.label}
          </Button>
        </div>
      </div>
    </Card>
  )
}
