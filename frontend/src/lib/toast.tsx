import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  createdAt: number
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

let nextId = 0
const DURATION = 4000

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string; bar: string }> = {
  success: { bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-400' },
  error: { bg: 'from-red-500/10 to-red-500/5', border: 'border-red-500/20', text: 'text-red-400', bar: 'bg-red-400' },
  warning: { bg: 'from-amber-500/10 to-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-400' },
  info: { bg: 'from-blue-500/10 to-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-400' },
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100)
  const Icon = ICONS[t.type]
  const c = COLORS[t.type]

  useEffect(() => {
    const start = t.createdAt
    const tick = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(remaining)
      if (remaining > 0) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [t.createdAt])

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-md shadow-lg
        bg-gradient-to-r ${c.bg} ${c.border} ${c.text} animate-slide-up overflow-hidden`}
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p className="text-sm flex-1 text-[var(--text-primary)] font-medium">{t.message}</p>
      <button onClick={onDismiss} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity text-[var(--text-muted)]">
        <X size={14} />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--surface-3)]">
        <div
          className={`h-full ${c.bar} transition-none rounded-full`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, type, message, createdAt: Date.now() }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
