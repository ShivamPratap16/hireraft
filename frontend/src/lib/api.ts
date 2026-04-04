const BASE = '/api'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('jp_token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...getAuthHeaders(), ...opts?.headers },
    ...opts,
  })
  if (res.status === 401) {
    localStorage.removeItem('jp_token')
    localStorage.removeItem('jp_user')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export interface Application {
  id: number
  job_title: string
  company_name: string
  platform: string
  job_url: string
  status: string
  applied_at: string | null
  updated_at: string | null
  notes: string
  follow_up_date: string
  other_platforms: string[]
}

export interface ApplicationPage {
  total: number
  page: number
  page_size: number
  items: Application[]
}

export interface PlatformSetting {
  id: number
  platform: string
  enabled: boolean
  username: string
  password: string
  daily_limit: number
  keywords: string
  role: string
  location: string
  experience: string
}

export interface GlobalSetting {
  id: number
  resume_path: string
  schedule_time: string
  schedule_enabled: boolean
}

export interface RunLog {
  id: number
  run_id: string
  platform: string
  level: string
  message: string
  timestamp: string | null
}

export interface Stats {
  total: number
  by_status: Record<string, number>
  by_platform: Record<string, number>
  follow_ups_due?: number
}

export interface Analytics {
  daily_applications: { date: string; count: number }[]
  by_platform: Record<string, number>
  success_rate_percent: number | null
  this_week_count: number
  prev_week_count: number
}

export interface BotRunRow {
  id: number
  run_id: string
  platform: string
  started_at: string | null
  finished_at: string | null
  status: string
  jobs_found: number
  jobs_applied: number
  jobs_skipped: number
  error_count: number
}

export interface RunDetail {
  run_id: string
  platforms: BotRunRow[]
  logs: RunLog[]
}

export interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  read: boolean
  created_at: string | null
}

export interface ProfileData {
  id: number
  full_name: string
  headline: string
  phone: string
  location: string
  date_of_birth: string
  gender: string
  summary: string
  skills: string
  languages: string
  education: string
  experience: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  other_url: string
  preferred_salary: string
  notice_period: string
  job_type: string
  work_mode: string
}

export const api = {
  getApplications: (params: Record<string, string | number | boolean>) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v === '' || v === undefined || v === null) continue
      if (typeof v === 'boolean') {
        if (v) qs.set(k, 'true')
        continue
      }
      qs.set(k, String(v))
    }
    return request<ApplicationPage>(`/applications?${qs}`)
  },

  updateApplication: (
    id: number,
    body: { status?: string; notes?: string; follow_up_date?: string }
  ) =>
    request<Application>(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getStats: () => request<Stats>('/applications/stats'),

  getAnalytics: () => request<Analytics>('/applications/analytics'),

  getPlatformSettings: () => request<PlatformSetting[]>('/settings/platforms'),

  updatePlatformSetting: (platform: string, data: Partial<PlatformSetting>) =>
    request<PlatformSetting>(`/settings/platforms/${platform}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getGlobalSettings: () => request<GlobalSetting>('/settings/global'),

  updateGlobalSettings: (data: Partial<GlobalSetting>) =>
    request<GlobalSetting>('/settings/global', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadResume: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = localStorage.getItem('jp_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE}/settings/resume`, { method: 'POST', body: form, headers })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  getLogs: (params?: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== undefined && v !== null) qs.set(k, String(v))
      }
    }
    return request<RunLog[]>(`/logs?${qs}`)
  },

  triggerRun: (platforms?: string[]) =>
    request<{ run_id: string; message: string }>('/run', {
      method: 'POST',
      body: JSON.stringify(platforms ? { platforms } : {}),
    }),

  getRunStatus: () => request<{ running: boolean }>('/run/status'),

  getRuns: (params?: { page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.page_size != null) qs.set('page_size', String(params.page_size))
    return request<{ total: number; page: number; page_size: number; items: BotRunRow[] }>(
      `/runs?${qs}`
    )
  },

  getRunDetail: (runId: string) => request<RunDetail>(`/runs/${runId}`),

  getNotifications: (unreadOnly?: boolean) =>
    request<NotificationItem[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),

  getUnreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationRead: (id: number) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),

  getProfile: () => request<ProfileData>('/profile'),

  updateProfile: (data: Partial<ProfileData>) =>
    request<ProfileData>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
