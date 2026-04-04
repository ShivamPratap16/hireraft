export const YEARS_OPTIONS = Array.from({ length: 31 }, (_, i) => i)
export const MONTHS_OPTIONS = Array.from({ length: 12 }, (_, i) => i)

export function parseExperience(exp: string): { years: number; months: number } {
  if (!exp) return { years: 0, months: 0 }
  const yMatch = exp.match(/(\d+)\s*y/i)
  const mMatch = exp.match(/(\d+)\s*m/i)
  if (yMatch || mMatch) {
    return { years: yMatch ? parseInt(yMatch[1]) : 0, months: mMatch ? parseInt(mMatch[1]) : 0 }
  }
  const num = parseInt(exp)
  return { years: isNaN(num) ? 0 : num, months: 0 }
}

export function formatExperience(years: number, months: number): string {
  if (years === 0 && months === 0) return ''
  if (months === 0) return `${years}y`
  if (years === 0) return `${months}m`
  return `${years}y ${months}m`
}
