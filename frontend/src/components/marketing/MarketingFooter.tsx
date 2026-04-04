import { Link } from 'react-router-dom'
import { Zap, Code2 } from 'lucide-react'

const productLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function MarketingFooter() {
  return (
    <footer className="pt-16 pb-10 border-t border-[var(--border)] bg-[var(--surface-1)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-8">
          <div className="col-span-2 md:col-span-4 lg:col-span-1 lg:max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[var(--text-primary)]">HireRaft</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Auto-apply engine for Naukri, LinkedIn, Indeed, and Internshala—scheduled runs and a clear application
              timeline.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Product</p>
            <ul className="space-y-2.5 text-sm">
              {productLinks.map(({ href, label }) => (
                <li key={href}>
                  <a href={href} className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Legal</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacy" className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Company</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="mailto:hello@hireraft.com"
                  className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">Get started</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/register" className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors">
                  Create account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-[var(--text-secondary)] hover:text-brand-400 transition-colors">
                  Log in
                </Link>
              </li>
            </ul>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-6 mb-3">Social</p>
            <div className="flex gap-3">
              <a
                href="https://github.com/hireraft"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-brand-400 hover:border-brand-500/30 transition-colors"
                aria-label="HireRaft on GitHub"
              >
                <Code2 size={18} />
              </a>
              <a
                href="https://x.com/joinhireraft"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-brand-400 hover:border-brand-500/30 transition-colors text-xs font-bold w-9 h-9 flex items-center justify-center"
                aria-label="HireRaft on X"
              >
                𝕏
              </a>
            </div>
          </div>
        </div>

        <p className="mt-12 pt-8 border-t border-[var(--border)] text-xs text-[var(--text-muted)] text-center md:text-left">
          © {new Date().getFullYear()} HireRaft. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
