import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, Zap } from 'lucide-react'
import { ThemeToggle } from '../ui'
import { buttonLinkClass } from '../ui/Button'

const ANCHORS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

function closeDrawer(setOpen: (v: boolean) => void) {
  setOpen(false)
}

export default function MarketingNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface-0)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              HireRaft
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--text-muted)]">
            {ANCHORS.map(({ href, label }) => (
              <a key={href} href={href} className="hover:text-[var(--text-primary)] transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle variant="icon" />
            <Link
              to="/login"
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5 transition-colors hidden sm:inline"
            >
              Log in
            </Link>
            <Link to="/register" className={`hidden sm:inline-flex ${buttonLinkClass('primary', 'sm', 'whitespace-nowrap')}`}>
              Get started
            </Link>
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setDrawerOpen((o) => !o)}
            >
              {drawerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-[var(--overlay-scrim)] backdrop-blur-sm md:hidden animate-fade-in"
            aria-hidden
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed top-0 right-0 bottom-0 z-[70] w-[min(100%,320px)] border-l border-[var(--border)] bg-[var(--surface-1)] shadow-2xl md:hidden animate-slide-in-right flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
              <button
                type="button"
                className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
              {ANCHORS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="px-3 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                  onClick={() => closeDrawer(setDrawerOpen)}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="p-4 border-t border-[var(--border)] space-y-2">
              <Link
                to="/login"
                className="block w-full text-center py-3 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                onClick={() => closeDrawer(setDrawerOpen)}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className={`block w-full text-center ${buttonLinkClass('primary', 'md', 'w-full py-3')}`}
                onClick={() => closeDrawer(setDrawerOpen)}
              >
                Get started
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  )
}
