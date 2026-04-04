/**
 * Set to `true` when you have customer logos — shows the onboarding copy + slot row below.
 * Code stays in the tree but is not rendered while `false`.
 */
const SHOW_CUSTOMER_LOGO_STRIP = false

/** Decorative slots only — replace with `<img src="…" alt="Company" />` when you have logo assets. */
function LogoSlot({ index }: { index: number }) {
  return (
    <div
      className="h-10 w-[5.5rem] sm:w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/80 opacity-60"
      aria-hidden
    >
      <span className="sr-only">Logo slot {index + 1}</span>
    </div>
  )
}

const testimonials = [
  {
    quote:
      'I stopped losing track of where I applied. The dashboard alone saved me hours every week—sample quote for layout.',
    name: 'Priya K.',
    role: 'Software engineer · Early access',
  },
  {
    quote:
      'Scheduling runs meant I could focus on interview prep instead of filling the same forms again—sample quote for layout.',
    name: 'Rahul M.',
    role: 'Product manager · Early access',
  },
]

export default function MarketingSocialProof() {
  return (
    <section className="py-14 border-b border-[var(--border)] bg-[var(--surface-1)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] text-center mb-3">
          Built for serious applicants
        </p>
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl mx-auto text-center mb-10">
          Job seekers who want to scale applications without losing track—early adopters and power applicants welcome.
        </p>

        {SHOW_CUSTOMER_LOGO_STRIP && (
          <>
            <p className="text-[11px] text-[var(--text-muted)] text-center mb-4 max-w-md mx-auto leading-relaxed">
              We&apos;re onboarding early teams—your logo can live here next. Until then, this row stays neutral so we
              don&apos;t imply customers we haven&apos;t named.
            </p>
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-14" role="presentation">
              {Array.from({ length: 6 }, (_, i) => (
                <LogoSlot key={i} index={i} />
              ))}
            </div>
          </>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-6 sm:p-8 relative"
            >
              <span className="absolute top-6 left-6 text-4xl text-brand-500/20 font-serif leading-none" aria-hidden>
                &ldquo;
              </span>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed pl-6 pt-2">{t.quote}</p>
              <footer className="mt-6 flex items-center gap-3 pl-6">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-700/40 flex items-center justify-center text-sm font-bold text-brand-300 border border-brand-500/20"
                  aria-hidden
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <cite className="not-italic text-sm font-semibold text-[var(--text-primary)]">{t.name}</cite>
                  <p className="text-xs text-[var(--text-muted)]">{t.role}</p>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
