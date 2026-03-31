export type SupporterTier =
  | 'founder'
  | 'supporter'
  | 'contributor'
  | 'engineering'
  | 'qa'
  | 'design'

export type RelationshipPriority =
  | 'self'
  | 'trusts-me'
  | 'i-trust'
  | 'i-follow'
  | 'follows-me'
  | 'other'

export interface TestimonialContribution {
  contribution: string
  public?: {recognition?: string; isRegularGift?: boolean} | null
}

export interface TestimonialAuthor {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  dek?: string
}

export interface Testimonial {
  id: string
  author: TestimonialAuthor
  message: string
  contributions: TestimonialContribution[]
  relationship: RelationshipPriority
}

/**
 * Deduplicates contributions by (contribution, recognition) pair,
 * then removes plain "Donor" if a more specific donor badge exists
 * (Founding Donor or Frequent Donor).
 */
export function deduplicateContributions(
  contributions: TestimonialContribution[],
): TestimonialContribution[] {
  // Step 1: dedupe by (contribution, recognition) pair
  const seen = new Set<string>()
  const unique = contributions.filter(c => {
    const key = `${c.contribution}:${c.public?.recognition ?? ''}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  // Step 2: remove plain "Donor" if a specific donor badge exists
  const hasSpecificDonor = unique.some(
    c =>
      c.contribution === 'donor' &&
      (c.public?.recognition === 'Founding Donor' || c.public?.isRegularGift),
  )

  if (!hasSpecificDonor) {
    return unique
  }

  return unique.filter(
    c =>
      c.contribution !== 'donor' ||
      c.public?.recognition === 'Founding Donor' ||
      c.public?.isRegularGift,
  )
}
