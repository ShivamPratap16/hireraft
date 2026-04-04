import type { LucideIcon } from 'lucide-react'
/* lucide-react (this version) does not ship brand icons like LinkedIn — use Link2 for a distinct “network” cue */
import { Link2, Building2, Briefcase, GraduationCap, Globe } from 'lucide-react'

export type PlatformMeta = {
  label: string
  color: string
  bg: string
  accentBar: string
  Icon: LucideIcon
}

/** Muted, distinguishable stripes (blue / rose / amber / teal) — low saturation on dark UI */
export const PLATFORM_META: Record<string, PlatformMeta> = {
  linkedin: {
    label: 'LinkedIn',
    color: 'text-blue-300',
    bg: 'bg-blue-500/8',
    accentBar: 'bg-blue-500',
    Icon: Link2,
  },
  indeed: {
    label: 'Indeed',
    color: 'text-rose-300',
    bg: 'bg-rose-500/8',
    accentBar: 'bg-rose-500',
    Icon: Building2,
  },
  naukri: {
    label: 'Naukri',
    color: 'text-amber-300',
    bg: 'bg-amber-500/8',
    accentBar: 'bg-amber-500',
    Icon: Briefcase,
  },
  internshala: {
    label: 'Internshala',
    color: 'text-teal-300',
    bg: 'bg-teal-500/8',
    accentBar: 'bg-teal-500',
    Icon: GraduationCap,
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
    }
  )
}
