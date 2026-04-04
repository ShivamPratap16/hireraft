import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { Button, SectionCard, ThemeToggle } from '../components/ui'
import Skeleton from '../components/ui/Skeleton'
import ToggleSwitch from '../components/automation/ToggleSwitch'
import PlatformAutomationCard from '../components/automation/PlatformAutomationCard'
import { Save, Upload, Clock, Palette } from 'lucide-react'

function GlobalResumeDropzone({
  resumeFile,
  onFile,
  currentBasename,
  onUpload,
  uploading,
}: {
  resumeFile: File | null
  onFile: (f: File | null) => void
  currentBasename: string | undefined
  onUpload: () => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const pickFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f) onFile(f)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="sr-only"
        onChange={(e) => pickFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          pickFiles(e.dataTransfer.files)
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-brand-500/50 bg-brand-500/5' : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--surface-0)]/25'}`}
      >
        <Upload className="mx-auto mb-2 text-[var(--text-muted)]" size={22} />
        <p className="text-sm text-[var(--text-secondary)]">Drop a PDF or Word file, or browse</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">.pdf, .doc, .docx</p>
        {resumeFile && (
          <p className="text-xs text-brand-400 mt-3 font-medium truncate max-w-full px-2">{resumeFile.name}</p>
        )}
        {!resumeFile && currentBasename && (
          <p className="text-xs text-[var(--text-muted)] mt-3">Current: {currentBasename}</p>
        )}
      </div>
      <div className="flex justify-end mt-3">
        <Button size="sm" variant="secondary" onClick={onUpload} disabled={!resumeFile} loading={uploading} icon={<Upload size={14} />}>
          Upload
        </Button>
      </div>
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()

  const { data: platforms, isLoading } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: api.getPlatformSettings,
  })

  const { data: global } = useQuery({
    queryKey: ['globalSettings'],
    queryFn: api.getGlobalSettings,
  })

  const { toast } = useToast()

  const globalMutation = useMutation({
    mutationFn: (data: { schedule_time?: string; schedule_enabled?: boolean }) => api.updateGlobalSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['globalSettings'] })
      toast('success', 'Global settings saved')
    },
    onError: () => toast('error', 'Failed to save global settings'),
  })

  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleGlobalSave = () => {
    globalMutation.mutate({
      schedule_time: scheduleTime || undefined,
      schedule_enabled: scheduleEnabled,
    })
  }

  const handleUpload = async () => {
    if (!resumeFile) return
    setUploading(true)
    try {
      await api.uploadResume(resumeFile)
      qc.invalidateQueries({ queryKey: ['globalSettings'] })
      setResumeFile(null)
      toast('success', 'Resume uploaded')
    } catch {
      toast('error', 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const currentResumeBasename = global?.resume_path?.split('/').pop()

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        <Skeleton variant="card" className="h-20" />
        <Skeleton variant="card" className="h-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-64" />
        ))}
      </div>
    )
  }

  const selectClass =
    'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all cursor-pointer appearance-none'

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="animate-slide-up">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Automation</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Configure platforms, credentials, search, and schedule</p>
      </div>

      <SectionCard
        title="Appearance"
        description="Light or dark interface"
        icon={<Palette size={18} />}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">Choose a theme. Your preference is saved on this device.</p>
          <ThemeToggle className="shrink-0" />
        </div>
      </SectionCard>

      <SectionCard
        title="Global settings"
        description="Daily schedule and resume"
        icon={<Clock size={18} />}
        action={
          <Button size="sm" loading={globalMutation.isPending} onClick={handleGlobalSave} icon={<Save size={14} />}>
            Save
          </Button>
        }
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Daily schedule</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
            <div className="flex flex-col gap-1.5 md:max-w-[200px]">
              <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">Run time</label>
              <input
                type="time"
                value={scheduleTime || global?.schedule_time || '09:00'}
                onChange={(e) => setScheduleTime(e.target.value)}
                className={selectClass}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer group pb-0.5 md:pb-1">
              <ToggleSwitch
                checked={scheduleEnabled ?? global?.schedule_enabled ?? true}
                onChange={setScheduleEnabled}
              />
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                Enable daily scheduled run
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-[var(--border)]/60 pt-6 mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Resume</p>
          <GlobalResumeDropzone
            resumeFile={resumeFile}
            onFile={setResumeFile}
            currentBasename={currentResumeBasename}
            onUpload={handleUpload}
            uploading={uploading}
          />
        </div>
      </SectionCard>

      <div className="space-y-6">
        {platforms?.map((ps, i) => (
          <div key={ps.platform} className="animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <PlatformAutomationCard setting={ps} />
          </div>
        ))}
      </div>
    </div>
  )
}
