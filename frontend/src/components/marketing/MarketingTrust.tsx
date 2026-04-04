import { Link } from 'react-router-dom'
import { Shield, Lock, FileKey } from 'lucide-react'

const items = [
  {
    icon: Lock,
    title: 'Credentials you control',
    desc: 'Platform logins stay under your account. Enable or disable automation per board anytime.',
  },
  {
    icon: Shield,
    title: 'Built for privacy-first workflows',
    desc: 'We only process what’s needed to run the product. Read the full picture in our privacy policy.',
  },
  {
    icon: FileKey,
    title: 'Transparent data practices',
    desc: 'Early-access terms spell out what we store today—swap in legal-reviewed copy before GA.',
  },
]

export default function MarketingTrust() {
  return (
    <section className="py-14 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-2">Security & trust</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Your search, your rules</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Honest positioning for early access—align final copy with your backend and legal review.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)]/60 p-6 text-center md:text-left"
            >
              <div className="inline-flex p-2.5 rounded-xl bg-brand-500/10 text-brand-400 mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-8 text-sm">
          <Link to="/privacy" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Read the Privacy Policy →
          </Link>
        </p>
      </div>
    </section>
  )
}
