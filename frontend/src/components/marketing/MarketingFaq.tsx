import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Is my login data safe?',
    a: 'Credentials are handled securely by the application. Review our Privacy Policy for details on what we store and how. Never share your passwords outside official login flows.',
  },
  {
    q: 'Which job boards are supported?',
    a: 'Naukri, LinkedIn, Indeed, and Internshala are supported today. We may add more platforms over time.',
  },
  {
    q: 'Do you guarantee job offers?',
    a: 'No. HireRaft is a tool to scale applications and stay organized. Outcomes depend on your profile, market, and roles you target.',
  },
  {
    q: 'Can I pause automation?',
    a: 'Yes. You can disable scheduled runs and per-platform toggles in Automation settings whenever you want.',
  },
  {
    q: 'Will pricing stay free forever?',
    a: 'Early access is free while we validate the product. We may introduce paid plans later with advance notice.',
  },
]

export default function MarketingFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 scroll-mt-16 border-b border-[var(--border)] bg-[var(--surface-1)]/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] text-center mb-4">FAQ</h2>
        <p className="text-center text-[var(--text-secondary)] text-sm mb-10">Common questions before you sign up.</p>
        <div className="space-y-2">
          {faqs.map((item, i) => {
            const isOpen = open === i
            return (
              <div
                key={item.q}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-3)]/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && <p className="px-4 pb-4 text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border)]/60 pt-3">{item.a}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
