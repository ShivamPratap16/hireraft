import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ProfileData } from '../lib/api'
import { useToast } from '../lib/toast'
import { Button, Input, Card, Avatar, ProgressBar, SectionCard as UISectionCard } from '../components/ui'
import Skeleton from '../components/ui/Skeleton'
import CityLocationField from '../components/CityLocationField'
import { primaryLocationToken } from '../data/cities'
import {
  Save, User, Briefcase, GraduationCap, Code, Link as LinkIcon,
  Phone, Calendar, Globe, GitFork, FileText, Clock,
  DollarSign, Building2, X, Plus, Trash2,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const GENDERS = ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say']
const JOB_TYPES = ['', 'Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship']
const WORK_MODES = ['', 'Remote', 'On-site', 'Hybrid']
const NOTICE_PERIODS = ['', 'Immediate', '15 days', '1 month', '2 months', '3 months', '6 months']

interface EducationEntry {
  degree: string
  institution: string
  year: string
  grade: string
}

interface ExperienceEntry {
  title: string
  company: string
  from: string
  to: string
  current: boolean
  description: string
}

function parseJSON<T>(str: string, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function calcCompletion(p: ProfileData): number {
  const fields = [
    p.full_name, p.headline, p.phone, p.location, p.summary,
    p.skills, p.education, p.experience, p.linkedin_url, p.job_type,
  ]
  const filled = fields.filter((f) => f && f.trim().length > 0 && f !== '[]').length
  return Math.round((filled / fields.length) * 100)
}

export default function Profile() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('personal')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  })

  const mutation = useMutation({
    mutationFn: (data: Partial<ProfileData>) => api.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      toast('success', 'Profile saved')
    },
    onError: () => toast('error', 'Failed to save profile'),
  })

  if (isLoading || !profile) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton variant="card" className="h-32" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10 w-28 rounded-xl shrink-0" />)}
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    )
  }

  const completion = calcCompletion(profile)

  const sections = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'skills', label: 'Skills', icon: Code },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'experience', label: 'Experience', icon: Building2 },
    { id: 'links', label: 'Links', icon: LinkIcon },
    { id: 'preferences', label: 'Preferences', icon: FileText },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Profile header */}
      <Card className="animate-slide-up" hover={false}>
        <div className="flex items-center gap-5">
          <Avatar name={profile.full_name || user?.name || user?.email || ''} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-[var(--text-primary)] truncate">
              {profile.full_name || user?.name || 'Your Profile'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] truncate mt-0.5">
              {profile.headline || 'Add a headline to stand out'}
            </p>
            <div className="mt-3 max-w-sm">
              <ProgressBar value={completion} label="Profile completion" />
            </div>
          </div>
        </div>
      </Card>

      {/* Section nav - pill tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 ${
              activeSection === id
                ? 'bg-gradient-to-r from-brand-500/15 to-brand-700/15 text-brand-400 border border-brand-500/20 shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:bg-[var(--surface-3)]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active section */}
      <div className="animate-fade-in" key={activeSection}>
        {activeSection === 'personal' && (
          <PersonalSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'professional' && (
          <ProfessionalSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'skills' && (
          <SkillsSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'education' && (
          <EducationSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'experience' && (
          <ExperienceSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'links' && (
          <LinksSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
        {activeSection === 'preferences' && (
          <PreferencesSection profile={profile} onSave={(d) => mutation.mutate(d)} saving={mutation.isPending} />
        )}
      </div>
    </div>
  )
}

/* ── Section Components ── */

interface SectionProps {
  profile: ProfileData
  onSave: (data: Partial<ProfileData>) => void
  saving: boolean
}

function SectionWrapper({ title, icon, onSave, saving, children }: {
  title: string; icon: React.ReactNode; onSave: () => void; saving: boolean; children: React.ReactNode
}) {
  return (
    <UISectionCard
      title={title}
      icon={icon}
      action={
        <Button size="sm" loading={saving} onClick={onSave} icon={<Save size={14} />}>
          Save
        </Button>
      }
    >
      {children}
    </UISectionCard>
  )
}

function PersonalSection({ profile, onSave, saving }: SectionProps) {
  const [form, setForm] = useState({
    full_name: profile.full_name,
    headline: profile.headline,
    phone: profile.phone,
    location: primaryLocationToken(profile.location),
    date_of_birth: profile.date_of_birth,
    gender: profile.gender,
  })
  return (
    <SectionWrapper title="Personal Information" icon={<User size={18} />} onSave={() => onSave(form)} saving={saving}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input icon={<User size={14} />} label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" />
        <Input icon={<Briefcase size={14} />} label="Headline" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Software Engineer at Google" />
        <Input icon={<Phone size={14} />} label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
        <CityLocationField mode="single" label="Location" value={form.location} onChange={(location) => setForm({ ...form, location })} />
        <Input icon={<Calendar size={14} />} label="Date of Birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Gender</label>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all cursor-pointer"
          >
            {GENDERS.map((g) => (
              <option key={g} value={g} className="bg-[var(--surface-1)]">{g || 'Select...'}</option>
            ))}
          </select>
        </div>
      </div>
    </SectionWrapper>
  )
}

function ProfessionalSection({ profile, onSave, saving }: SectionProps) {
  const [summary, setSummary] = useState(profile.summary)
  return (
    <SectionWrapper title="Professional Summary" icon={<Briefcase size={18} />} onSave={() => onSave({ summary })} saving={saving}>
      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide mb-1.5 block">About You</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          placeholder="Write a brief summary about your professional background, key achievements, and what you're looking for..."
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all resize-none"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">{summary.length} characters</p>
      </div>
    </SectionWrapper>
  )
}

function SkillsSection({ profile, onSave, saving }: SectionProps) {
  const [skills, setSkills] = useState<string[]>(
    profile.skills ? profile.skills.split(',').map((s) => s.trim()).filter(Boolean) : []
  )
  const [languages, setLanguages] = useState(profile.languages)
  const [input, setInput] = useState('')

  const addSkill = (skill: string) => {
    const trimmed = skill.trim()
    if (trimmed && !skills.includes(trimmed)) setSkills([...skills, trimmed])
    setInput('')
  }

  return (
    <SectionWrapper title="Skills & Languages" icon={<Code size={18} />} onSave={() => onSave({ skills: skills.join(', '), languages })} saving={saving}>
      <div className="space-y-5">
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide mb-1.5 block">Skills</label>
          <div className="flex flex-wrap gap-1.5 min-h-[44px] bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]/50 transition-all">
            {skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg px-2.5 py-1 text-xs font-medium animate-slide-up"
              >
                {skill}
                <button type="button" onClick={() => setSkills(skills.filter((s) => s !== skill))} className="hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(input) } }}
              placeholder={skills.length === 0 ? 'Type a skill and press Enter...' : 'Add more...'}
              className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">{skills.length} skills added</p>
        </div>
        <Input icon={<Globe size={14} />} label="Languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi, Spanish" />
      </div>
    </SectionWrapper>
  )
}

function EducationSection({ profile, onSave, saving }: SectionProps) {
  const [entries, setEntries] = useState<EducationEntry[]>(parseJSON(profile.education, []))

  const addEntry = () => setEntries([...entries, { degree: '', institution: '', year: '', grade: '' }])
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i))
  const updateEntry = (i: number, field: keyof EducationEntry, value: string) => {
    const updated = [...entries]
    updated[i] = { ...updated[i], [field]: value }
    setEntries(updated)
  }

  return (
    <SectionWrapper title="Education" icon={<GraduationCap size={18} />} onSave={() => onSave({ education: JSON.stringify(entries) })} saving={saving}>
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="relative pl-5 border-l-2 border-brand-500/20 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-brand-500" />
            <div className="glass rounded-xl p-4 space-y-3">
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Degree / Course" value={entry.degree} onChange={(e) => updateEntry(i, 'degree', e.target.value)} placeholder="B.Tech Computer Science" />
                <Input label="Institution" value={entry.institution} onChange={(e) => updateEntry(i, 'institution', e.target.value)} placeholder="IIT Delhi" />
                <Input label="Year of Completion" value={entry.year} onChange={(e) => updateEntry(i, 'year', e.target.value)} placeholder="2024" />
                <Input label="Grade / CGPA" value={entry.grade} onChange={(e) => updateEntry(i, 'grade', e.target.value)} placeholder="8.5 CGPA" />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)]
            hover:text-brand-400 hover:border-brand-500/30 hover:bg-brand-500/5 transition-all w-full justify-center"
        >
          <Plus size={16} />
          Add Education
        </button>
      </div>
    </SectionWrapper>
  )
}

function ExperienceSection({ profile, onSave, saving }: SectionProps) {
  const [entries, setEntries] = useState<ExperienceEntry[]>(parseJSON(profile.experience, []))

  const addEntry = () => setEntries([...entries, { title: '', company: '', from: '', to: '', current: false, description: '' }])
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i))
  const updateEntry = (i: number, field: keyof ExperienceEntry, value: string | boolean) => {
    const updated = [...entries]
    updated[i] = { ...updated[i], [field]: value }
    if (field === 'current' && value === true) updated[i].to = 'Present'
    setEntries(updated)
  }

  return (
    <SectionWrapper title="Work Experience" icon={<Building2 size={18} />} onSave={() => onSave({ experience: JSON.stringify(entries) })} saving={saving}>
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="relative pl-5 border-l-2 border-brand-500/20 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-brand-500" />
            <div className="glass rounded-xl p-4 space-y-3">
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Job Title" value={entry.title} onChange={(e) => updateEntry(i, 'title', e.target.value)} placeholder="Software Engineer" />
                <Input label="Company" value={entry.company} onChange={(e) => updateEntry(i, 'company', e.target.value)} placeholder="Google" />
                <Input label="From" value={entry.from} onChange={(e) => updateEntry(i, 'from', e.target.value)} placeholder="Jan 2022" />
                <div>
                  <Input label="To" value={entry.current ? 'Present' : entry.to} onChange={(e) => updateEntry(i, 'to', e.target.value)} placeholder="Dec 2024" disabled={entry.current} />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.current}
                      onChange={(e) => updateEntry(i, 'current', e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border)] text-brand-600 cursor-pointer"
                    />
                    <span className="text-xs text-[var(--text-muted)]">Currently working here</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide mb-1.5 block">Description</label>
                <textarea
                  value={entry.description}
                  onChange={(e) => updateEntry(i, 'description', e.target.value)}
                  rows={2}
                  placeholder="Key responsibilities and achievements..."
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all resize-none"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)]
            hover:text-brand-400 hover:border-brand-500/30 hover:bg-brand-500/5 transition-all w-full justify-center"
        >
          <Plus size={16} />
          Add Experience
        </button>
      </div>
    </SectionWrapper>
  )
}

function LinksSection({ profile, onSave, saving }: SectionProps) {
  const [form, setForm] = useState({
    linkedin_url: profile.linkedin_url,
    github_url: profile.github_url,
    portfolio_url: profile.portfolio_url,
    other_url: profile.other_url,
  })
  return (
    <SectionWrapper title="Social & Portfolio Links" icon={<LinkIcon size={18} />} onSave={() => onSave(form)} saving={saving}>
      <div className="grid grid-cols-1 gap-4">
        <Input icon={<Globe size={14} />} label="LinkedIn" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/yourname" />
        <Input icon={<GitFork size={14} />} label="GitHub" value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/yourname" />
        <Input icon={<Globe size={14} />} label="Portfolio / Website" value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} placeholder="https://yourportfolio.com" />
        <Input icon={<LinkIcon size={14} />} label="Other Link" value={form.other_url} onChange={(e) => setForm({ ...form, other_url: e.target.value })} placeholder="https://..." />
      </div>
    </SectionWrapper>
  )
}

function PreferencesSection({ profile, onSave, saving }: SectionProps) {
  const [form, setForm] = useState({
    preferred_salary: profile.preferred_salary,
    notice_period: profile.notice_period,
    job_type: profile.job_type,
    work_mode: profile.work_mode,
  })

  const selectClass = "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all cursor-pointer appearance-none"

  return (
    <SectionWrapper title="Job Preferences" icon={<FileText size={18} />} onSave={() => onSave(form)} saving={saving}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input icon={<DollarSign size={14} />} label="Expected Salary (Annual)" value={form.preferred_salary} onChange={(e) => setForm({ ...form, preferred_salary: e.target.value })} placeholder="12 LPA" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Notice Period</label>
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select value={form.notice_period} onChange={(e) => setForm({ ...form, notice_period: e.target.value })} className={`${selectClass} pl-10`}>
              {NOTICE_PERIODS.map((o) => <option key={o} value={o} className="bg-[var(--surface-1)]">{o || 'Select...'}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Job Type</label>
          <div className="relative">
            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })} className={`${selectClass} pl-10`}>
              {JOB_TYPES.map((o) => <option key={o} value={o} className="bg-[var(--surface-1)]">{o || 'Select...'}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Work Mode</label>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select value={form.work_mode} onChange={(e) => setForm({ ...form, work_mode: e.target.value })} className={`${selectClass} pl-10`}>
              {WORK_MODES.map((o) => <option key={o} value={o} className="bg-[var(--surface-1)]">{o || 'Select...'}</option>)}
            </select>
          </div>
        </div>
      </div>
    </SectionWrapper>
  )
}
