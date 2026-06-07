import type { LucideIcon } from 'lucide-react'
/* lucide-react (this version) does not ship brand icons like LinkedIn — use Link2 for a distinct "network" cue */
import { Link2, Building2, Briefcase, GraduationCap, Globe, Compass, Leaf, Sparkles, Square, Layers } from 'lucide-react'

export type PlatformMeta = {
  label: string
  color: string
  bg: string
  accentBar: string
  Icon: LucideIcon
  /** Discovery (ATS-API) platforms don't need credentials — username/password
   * fields are hidden on their PlatformAutomationCard. */
  kind?: 'automation' | 'discovery'
}

/** Discovery (ATS-API) platforms — no credentials, public APIs. */
export const DISCOVERY_PLATFORMS = new Set([
  'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters',
])

/** Muted, distinguishable stripes (blue / rose / amber / teal) — low saturation on dark UI */
export const PLATFORM_META: Record<string, PlatformMeta> = {
  linkedin: {
    label: 'LinkedIn',
    color: 'text-blue-300',
    bg: 'bg-blue-500/8',
    accentBar: 'bg-blue-500',
    Icon: Link2,
    kind: 'automation',
  },
  indeed: {
    label: 'Indeed',
    color: 'text-rose-300',
    bg: 'bg-rose-500/8',
    accentBar: 'bg-rose-500',
    Icon: Building2,
    kind: 'automation',
  },
  naukri: {
    label: 'Naukri',
    color: 'text-amber-300',
    bg: 'bg-amber-500/8',
    accentBar: 'bg-amber-500',
    Icon: Briefcase,
    kind: 'automation',
  },
  internshala: {
    label: 'Internshala',
    color: 'text-teal-300',
    bg: 'bg-teal-500/8',
    accentBar: 'bg-teal-500',
    Icon: GraduationCap,
    kind: 'automation',
  },
  // Discovery channel (public ATS APIs — no credentials required)
  greenhouse: {
    label: 'Greenhouse',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/8',
    accentBar: 'bg-emerald-500',
    Icon: Leaf,
    kind: 'discovery',
  },
  lever: {
    label: 'Lever',
    color: 'text-violet-300',
    bg: 'bg-violet-500/8',
    accentBar: 'bg-violet-500',
    Icon: Compass,
    kind: 'discovery',
  },
  ashby: {
    label: 'Ashby',
    color: 'text-fuchsia-300',
    bg: 'bg-fuchsia-500/8',
    accentBar: 'bg-fuchsia-500',
    Icon: Sparkles,
    kind: 'discovery',
  },
  workable: {
    label: 'Workable',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/8',
    accentBar: 'bg-cyan-500',
    Icon: Square,
    kind: 'discovery',
  },
  smartrecruiters: {
    label: 'SmartRecruiters',
    color: 'text-sky-300',
    bg: 'bg-sky-500/8',
    accentBar: 'bg-sky-500',
    Icon: Layers,
    kind: 'discovery',
  },
}

export function getPlatformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_META[platform] ?? {
      label: platform,
      color: 'text-gray-400',
      bg: 'bg-gray-500/8',
      accentBar: 'bg-gray-500',
      Icon: Globe,
      kind: 'automation',
    }
  )
}

export function isDiscoveryPlatform(platform: string): boolean {
  return DISCOVERY_PLATFORMS.has(platform)
}
