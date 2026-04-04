import { Link } from 'react-router-dom'
import { GraduationCap, Briefcase, Home } from 'lucide-react'
import { buttonLinkClass } from '../ui/Button'

const cases = [
  {
    icon: GraduationCap,
    title: 'Fresh graduates',
    desc: 'High volume, tight timelines. Automate first-pass applications while you tailor cover letters for dream roles.',
  },
  {
    icon: Briefcase,
    title: 'Experienced hires',
    desc: 'Stay visible without living in six tabs. Keep senior-level searches organized across boards.',
  },
  {
    icon: Home,
    title: 'Remote-first',
    desc: 'Target location-agnostic listings consistently—HireRaft repeats your criteria every run.',
  },
]

export default function MarketingUseCases() {
  return (
    <section id="use-cases" className="py-20 scroll-mt-16 border-b border-[var(--border)] bg-[var(--surface-1)]/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] text-center mb-4">Built for how you job hunt</h2>
        <p className="text-center text-[var(--text-secondary)] max-w-xl mx-auto mb-12">
          Whether you&apos;re breaking in or leveling up, the same engine adapts to your search intensity.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {cases.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-6 flex flex-col hover:border-brand-500/20 transition-colors"
            >
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 w-fit mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed flex-1">{desc}</p>
              <Link to="/register" className={`mt-6 ${buttonLinkClass('secondary', 'sm', 'w-full justify-center')}`}>
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
