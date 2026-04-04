import MarketingNav from '../../components/marketing/MarketingNav'
import MarketingHero from '../../components/marketing/MarketingHero'
import MarketingSocialProof from '../../components/marketing/MarketingSocialProof'
import MarketingTrust from '../../components/marketing/MarketingTrust'
import MarketingBento from '../../components/marketing/MarketingBento'
import MarketingSteps from '../../components/marketing/MarketingSteps'
import MarketingUseCases from '../../components/marketing/MarketingUseCases'
import MarketingPricing from '../../components/marketing/MarketingPricing'
import MarketingFaq from '../../components/marketing/MarketingFaq'
import MarketingCtaBand from '../../components/marketing/MarketingCtaBand'
import MarketingFooter from '../../components/marketing/MarketingFooter'
import MarketingReveal from '../../components/marketing/MarketingReveal'

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--text-primary)]">
      <MarketingNav />
      <main>
        <MarketingHero />
        <MarketingReveal>
          <MarketingSocialProof />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingTrust />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingBento />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingSteps />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingUseCases />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingPricing />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingFaq />
        </MarketingReveal>
        <MarketingReveal>
          <MarketingCtaBand />
        </MarketingReveal>
      </main>
      <MarketingFooter />
    </div>
  )
}
