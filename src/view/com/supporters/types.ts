export type SupporterTier = 'founder' | 'supporter' | 'contributor'

export type RelationshipPriority =
  | 'self'
  | 'trusts-me'
  | 'i-trust'
  | 'i-follow'
  | 'follows-me'
  | 'other'

export interface TestimonialAuthor {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

export interface Testimonial {
  id: string
  author: TestimonialAuthor
  message: string
  badges: SupporterTier[]
  relationship: RelationshipPriority
}
