import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../lib/theme'

type Props = {
  className?: string
  /** Compact icon-only cycle button */
  variant?: 'segmented' | 'icon'
}

export default function ThemeToggle({ className = '', variant = 'segmented' }: Props) {
  const { theme, setTheme } = useTheme()

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`p-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]
          hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors ${className}`}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    )
  }

  return (
    <div
      className={`inline-flex rounded-xl p-0.5 bg-[var(--surface-2)] border border-[var(--border)] ${className}`}
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'dark'
            ? 'bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
      >
        <Moon size={14} />
        Dark
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'light'
            ? 'bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
      >
        <Sun size={14} />
        Light
      </button>
    </div>
  )
}
