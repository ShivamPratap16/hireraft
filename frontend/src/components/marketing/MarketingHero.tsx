import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { buttonLinkClass } from '../ui/Button'
import HeroProductVisual from './HeroProductVisual'

export default function MarketingHero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 via-transparent to-brand-700/10 pointer-events-none motion-hero-bg" />
      <div className="absolute top-20 -left-40 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl pointer-events-none motion-float-slow" />
      <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-brand-700/10 blur-3xl pointer-events-none motion-float-slow-delayed" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 md:pt-20 md:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-6 animate-slide-up">
              <Sparkles size={14} />
              Auto-apply across major job boards
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-[var(--text-primary)] tracking-tight max-w-xl mx-auto lg:mx-0 leading-[1.08] animate-slide-up">
              Land interviews while you sleep
            </h1>
            <p
              className="mt-6 text-lg sm:text-xl text-[var(--text-secondary)] max-w-xl mx-auto lg:mx-0 leading-relaxed animate-slide-up"
              style={{ animationDelay: '0.05s' }}
            >
              HireRaft applies to matching roles on Naukri, LinkedIn, Indeed, and Internshala—on your schedule—with a
              clear dashboard for every application.
            </p>
            <div
              className="mt-10 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 animate-slide-up"
              style={{ animationDelay: '0.1s' }}
            >
              <Link to="/register" className={buttonLinkClass('primary', 'lg', 'min-w-[200px] gap-2')}>
                Create free account
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className={buttonLinkClass('secondary', 'lg', 'min-w-[160px]')}>
                Log in
              </Link>
            </div>
          </div>

          <div className="max-w-lg mx-auto w-full lg:max-w-none animate-slide-up" style={{ animationDelay: '0.12s' }}>
            <HeroProductVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
