const steps = [
  { n: '1', title: 'Create your account', desc: 'Sign up in seconds—no credit card for the beta.' },
  { n: '2', title: 'Connect platforms', desc: 'Add credentials and search preferences per board in Automation.' },
  { n: '3', title: 'Upload your resume', desc: 'One resume powers applications across supported sites.' },
  { n: '4', title: 'Run and monitor', desc: 'Start a run or use the daily schedule; track everything on the dashboard.' },
]

export default function MarketingSteps() {
  return (
    <section id="how-it-works" className="py-20 scroll-mt-16 border-b border-[var(--border)] bg-[var(--surface-1)]/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl font-bold text-[var(--text-primary)] text-center mb-4">How it works</h2>
        <p className="text-center text-[var(--text-secondary)] max-w-xl mx-auto mb-14">
          From signup to your first batch of applications in a few guided steps.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 animate-slide-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/15 text-brand-400 text-sm font-bold mb-3">
                {s.n}
              </span>
              <h3 className="font-semibold text-[var(--text-primary)]">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
