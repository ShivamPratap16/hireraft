import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import { ThemeToggle } from '../../components/ui'

export default function LegalLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-brand-400 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                HireRaft
              </span>
            </Link>
            <ThemeToggle variant="icon" />
          </div>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">{title}</h1>
        <div className="max-w-none text-[var(--text-secondary)] space-y-4 text-sm leading-relaxed">
          {children}
        </div>
      </article>
    </div>
  )
}
