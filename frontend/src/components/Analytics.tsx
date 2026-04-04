import { useEffect } from 'react'

/**
 * Loads an optional analytics script when VITE_ENABLE_ANALYTICS=true and VITE_ANALYTICS_SCRIPT_URL is set.
 * Example: Plausible, self-hosted script, or GA loader URL.
 */
export default function Analytics() {
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_ANALYTICS !== 'true') return
    const src = import.meta.env.VITE_ANALYTICS_SCRIPT_URL
    if (!src) return

    const existing = document.querySelector(`script[data-hireraft-analytics="1"]`)
    if (existing) return

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.hireraftAnalytics = '1'
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return null
}
