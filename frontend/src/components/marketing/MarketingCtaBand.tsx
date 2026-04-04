import { Link } from 'react-router-dom'
import { buttonLinkClass } from '../ui/Button'

export default function MarketingCtaBand() {
  return (
    <section className="py-16 border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Ready to automate your search?</h2>
        <p className="mt-3 text-[var(--text-secondary)]">Join in minutes. Adjust platforms and limits anytime.</p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/register" className={buttonLinkClass('primary', 'lg', 'min-w-[200px]')}>
            Create account
          </Link>
          <Link to="/login" className={buttonLinkClass('secondary', 'lg', 'min-w-[160px]')}>
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  )
}
