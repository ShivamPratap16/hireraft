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

// ─── Types ─────────────────────────────────────────────────────────────────
export interface Application {
  id: string; job_title: string; company_name: string; platform: string
  job_url: string; status: string; applied_at: string | null
  updated_at: string | null; notes: string; follow_up_date: string
  other_platforms: string[]
}
export interface ApplicationPage { total: number; page: number; page_size: number; items: Application[] }
export interface PlatformSetting {
  id: string; platform: string; enabled: boolean; username: string
  password: string; daily_limit: number; keywords: string; role: string
  location: string; experience: string
}
export interface GlobalSetting { id: string; resume_path: string; schedule_time: string; schedule_enabled: boolean }
export interface RunLog { id: string; run_id: string; platform: string; level: string; message: string; timestamp: string | null }
export interface Stats { total: number; by_status: Record<string, number>; by_platform: Record<string, number>; follow_ups_due?: number }
export interface Analytics {
  daily_applications: { date: string; count: number }[]; by_platform: Record<string, number>
  success_rate_percent: number | null; this_week_count: number; prev_week_count: number
}
export interface BotRunRow {
  id: string; run_id: string; platform: string; started_at: string | null
  finished_at: string | null; status: string; jobs_found: number
  jobs_applied: number; jobs_skipped: number; error_count: number
}
export interface RunDetail { run_id: string; platforms: BotRunRow[]; logs: RunLog[] }
export interface NotificationItem { id: string; type: string; title: string; message: string; read: boolean; created_at: string | null }
export interface ProfileData {
  id: string; full_name: string; headline: string; phone: string; location: string
  date_of_birth: string; gender: string; summary: string; skills: string
  languages: string; education: string; experience: string; linkedin_url: string
  github_url: string; portfolio_url: string; other_url: string
  preferred_salary: string; notice_period: string; job_type: string; work_mode: string
}

// Admin types
export interface AdminStats {
  total_users: number; total_applications: number; total_runs: number
  active_users_7d: number; total_errors: number; apps_today: number; apps_this_week: number
}
export interface AdminUserRow {
  id: string; email: string; name: string; role: string
  is_blocked: boolean; created_at: string | null; app_count: number; run_count: number
}
export interface AdminUserDetail {
  user: { id: string; email: string; name: string; role: string; created_at: string | null; hashed_password: string }
  stats: { app_count: number; run_count: number }
  profile: Record<string, any>
  platform_settings: any[]
  global_settings: Record<string, any>
  applications: any[]
  bot_runs: any[]
  logs: any[]
}
export interface AdminAnalytics {
  daily_applications: { date: string; count: number }[]
  by_platform: Record<string, number>; by_status: Record<string, number>
  error_trend: { date: string; count: number }[]
  registration_trend: { date: string; count: number }[]
}

// ─── API ───────────────────────────────────────────────────────────────────
export const api = {
  // Admin
  getAdminStats: () => request<AdminStats>('/admin/stats'),
  getAdminUsers: (skip = 0, limit = 50, search = '') =>
    request<{ items: AdminUserRow[]; total: number }>(`/admin/users?skip=${skip}&limit=${limit}&search=${encodeURIComponent(search)}`),
  getAdminUserDetail: (userId: string) => request<AdminUserDetail>(`/admin/users/${userId}`),
  updateAdminUserRole: (userId: string, role: string) =>
    request<{ ok: boolean }>(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteAdminUser: (userId: string) =>
    request<{ ok: boolean }>(`/admin/users/${userId}`, { method: 'DELETE' }),
  resetAdminUserPassword: (userId: string, newPassword: string) =>
    request<{ ok: boolean }>(`/admin/users/${userId}/password`, { method: 'PATCH', body: JSON.stringify({ new_password: newPassword }) }),
  toggleBlockUser: (userId: string) =>
    request<{ ok: boolean; is_blocked: boolean }>(`/admin/users/${userId}/block`, { method: 'PATCH' }),
  getAdminActivity: (limit = 50) => request<{ items: any[] }>(`/admin/activity?limit=${limit}`),
  getAdminAnalytics: () => request<AdminAnalytics>('/admin/analytics'),

  // Standard
  getApplications: (params: Record<string, string | number | boolean>) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v === '' || v === undefined || v === null) continue
      if (typeof v === 'boolean') { if (v) qs.set(k, 'true'); continue }
      qs.set(k, String(v))
    }
    return request<ApplicationPage>(`/applications?${qs}`)
  },
  updateApplication: (id: string, body: { status?: string; notes?: string; follow_up_date?: string }) =>
    request<Application>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getStats: () => request<Stats>('/applications/stats'),
  getAnalytics: () => request<Analytics>('/applications/analytics'),
  getPlatformSettings: () => request<PlatformSetting[]>('/settings/platforms'),
  updatePlatformSetting: (platform: string, data: Partial<PlatformSetting>) =>
    request<PlatformSetting>(`/settings/platforms/${platform}`, { method: 'PUT', body: JSON.stringify(data) }),
  getGlobalSettings: () => request<GlobalSetting>('/settings/global'),
  updateGlobalSettings: (data: Partial<GlobalSetting>) =>
    request<GlobalSetting>('/settings/global', { method: 'PUT', body: JSON.stringify(data) }),
  uploadResume: async (file: File) => {
    const form = new FormData(); form.append('file', file)
    const token = localStorage.getItem('jp_token')
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${BASE}/settings/resume`, { method: 'POST', body: form, headers })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },
  getLogs: (params?: Record<string, string | number>) => {
    const qs = new URLSearchParams()
    if (params) { for (const [k, v] of Object.entries(params)) { if (v !== '' && v !== undefined && v !== null) qs.set(k, String(v)) } }
    return request<RunLog[]>(`/logs?${qs}`)
  },
  triggerRun: (platforms?: string[]) =>
    request<{ run_id: string; message: string }>('/run', { method: 'POST', body: JSON.stringify(platforms ? { platforms } : {}) }),
  getRunStatus: () => request<{ running: boolean }>('/run/status'),
  getRuns: (params?: { page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.page_size != null) qs.set('page_size', String(params.page_size))
    return request<{ total: number; page: number; page_size: number; items: BotRunRow[] }>(`/runs?${qs}`)
  },
  getRunDetail: (runId: string) => request<RunDetail>(`/runs/${runId}`),
  getNotifications: (unreadOnly?: boolean) =>
    request<NotificationItem[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
  getUnreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) => request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
  getProfile: () => request<ProfileData>('/profile'),
  updateProfile: (data: Partial<ProfileData>) =>
    request<ProfileData>('/profile', { method: 'PUT', body: JSON.stringify(data) }),
}
