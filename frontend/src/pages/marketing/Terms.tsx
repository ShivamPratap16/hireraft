import LegalLayout from './LegalLayout'

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These Terms of Service govern your use of HireRaft. This is a <strong className="text-[var(--text-primary)]">placeholder</strong>{' '}
        for early access—replace with terms appropriate for your jurisdiction and business model before general availability.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Service.</strong> HireRaft provides tools to help you manage job
        applications and related automation. Features may change during beta.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Your responsibilities.</strong> You are responsible for your account,
        compliance with third-party sites&apos; terms when using automation, and the accuracy of information you provide.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Disclaimer.</strong> The service is provided &quot;as is&quot; during
        early access without warranties. Add your full limitation of liability and dispute resolution clauses with legal
        review.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Contact.</strong>{' '}
        <a href="mailto:hello@hireraft.com" className="text-brand-400 hover:underline">
          hello@hireraft.com
        </a>
      </p>
      <p className="text-[var(--text-muted)] text-xs pt-4">Last updated: {new Date().toISOString().slice(0, 10)}</p>
    </LegalLayout>
  )
}
