import { Link } from 'react-router-dom'
import { buttonLinkClass } from '../ui/Button'
import { Check } from 'lucide-react'

const bullets = [
  'Dashboard & application tracking',
  'Automation for 4 job platforms',
  'Scheduled daily runs',
  'Logs and notifications',
]

export default function MarketingPricing() {
  return (
    <section id="pricing" className="py-20 scroll-mt-16 border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] text-center mb-4">Simple pricing</h2>
        <p className="text-center text-[var(--text-secondary)] max-w-lg mx-auto mb-12">
          We&apos;re focused on product-market fit. Early access is free while we iterate—pricing may change with a fair
          notice.
        </p>
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border-2 border-brand-500/30 bg-[var(--surface-2)] p-8 shadow-lg shadow-brand-500/5">
            <p className="text-sm font-semibold text-brand-400 uppercase tracking-wide">Beta / early access</p>
            <p className="mt-2 text-4xl font-bold text-[var(--text-primary)]">Free</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Full product access during this phase</p>
            <ul className="mt-8 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <Link to="/register" className={buttonLinkClass('primary', 'lg', 'mt-8 w-full justify-center')}>
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
