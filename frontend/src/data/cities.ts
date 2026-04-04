/**
 * Major Indian cities + common job-search locations for platform automation.
 * Sorted A–Z for the dropdown; value stored is the string shown.
 */
export const JOB_SEARCH_CITIES: string[] = [
  'Agartala',
  'Agra',
  'Ahmedabad',
  'Ajmer',
  'Amritsar',
  'Aurangabad',
  'Bangalore',
  'Bhopal',
  'Bhubaneswar',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Dehradun',
  'Delhi',
  'Dhanbad',
  'Faridabad',
  'Ghaziabad',
  'Goa',
  'Gurgaon',
  'Guwahati',
  'Gwalior',
  'Howrah',
  'Hubli',
  'Hyderabad',
  'Indore',
  'Jaipur',
  'Jammu',
  'Jamshedpur',
  'Jodhpur',
  'Kanpur',
  'Kochi',
  'Kolkata',
  'Kozhikode',
  'Lucknow',
  'Ludhiana',
  'Madurai',
  'Mangalore',
  'Meerut',
  'Mumbai',
  'Mysore',
  'Nagpur',
  'Nashik',
  'Noida',
  'Patna',
  'Pimpri-Chinchwad',
  'Pune',
  'Raipur',
  'Rajkot',
  'Ranchi',
  'Remote',
  'Salem',
  'Solapur',
  'Srinagar',
  'Surat',
  'Thane',
  'Thiruvananthapuram',
  'Tiruchirappalli',
  'Udaipur',
  'Vadodara',
  'Varanasi',
  'Vijayawada',
  'Visakhapatnam',
].sort((a, b) => a.localeCompare(b))

export const JOB_SEARCH_CITY_SET = new Set(JOB_SEARCH_CITIES)

/** One-tap adds — typical “big product” location shortcuts (metros + remote). */
export const POPULAR_JOB_CITIES: readonly string[] = [
  'Bangalore',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Gurgaon',
  'Noida',
  'Kolkata',
  'Remote',
]

/**
 * Parse stored location string into discrete tokens.
 * Keeps values like "Bangalore, India" as one token if parts aren't all known cities.
 */
export function parseLocationTokens(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (JOB_SEARCH_CITY_SET.has(t)) return [t]
  const parts = t.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) return parts
  const allKnown = parts.every((p) => JOB_SEARCH_CITY_SET.has(p))
  if (allKnown) return parts
  return [t]
}

export function joinLocationTokens(tokens: string[]): string {
  return tokens.join(', ')
}

/** First city token for profile / single-select UIs (multi-city strings become first listed city). */
export function primaryLocationToken(raw: string): string {
  const t = parseLocationTokens(raw.trim())
  return t[0] ?? ''
}
