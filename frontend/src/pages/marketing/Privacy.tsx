import LegalLayout from './LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        This Privacy Policy describes how HireRaft (&quot;we&quot;, &quot;us&quot;) handles information when you use our
        service. This is a <strong className="text-[var(--text-primary)]">placeholder</strong> for early access—you should
        replace it with a policy reviewed by qualified counsel before public launch.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Information you provide.</strong> When you register, we may collect
        account details such as your name, email address, and profile information you choose to submit.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Platform credentials.</strong> If you store credentials or tokens
        to enable automation, they are used only to operate the features you enable. Describe your actual storage,
        encryption, and retention practices here.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Usage data.</strong> We may collect technical and usage data to
        operate and improve the service (e.g. logs, device/browser type). If you use analytics, disclose the provider
        here.
      </p>
      <p>
        <strong className="text-[var(--text-primary)]">Contact.</strong> For privacy questions, contact{' '}
        <a href="mailto:hello@hireraft.com" className="text-brand-400 hover:underline">
          hello@hireraft.com
        </a>
        .
      </p>
      <p className="text-[var(--text-muted)] text-xs pt-4">Last updated: {new Date().toISOString().slice(0, 10)}</p>
    </LegalLayout>
  )
}
