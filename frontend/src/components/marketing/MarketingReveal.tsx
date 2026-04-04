import type { ReactNode } from 'react'
import { useInView } from '../../lib/useInView'

export default function MarketingReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useInView<HTMLDivElement>()

  return (
    <div ref={ref} className={`reveal-on-scroll ${visible ? 'reveal-on-scroll-visible' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
