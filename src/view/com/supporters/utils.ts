import {RelationshipPriority, Testimonial} from './types'

const RELATIONSHIP_ORDER: Record<RelationshipPriority, number> = {
  self: 0,
  'trusts-me': 1,
  'i-trust': 2,
  'i-follow': 3,
  'follows-me': 4,
  other: 5,
}

/**
 * Sorts testimonials by relationship priority
 * Self first, then trusts-me, i-trust, i-follow, follows-me, and other last
 */
export function sortTestimonialsByRelationship(
  testimonials: Testimonial[],
): Testimonial[] {
  return [...testimonials].sort((a, b) => {
    return (
      RELATIONSHIP_ORDER[a.relationship] - RELATIONSHIP_ORDER[b.relationship]
    )
  })
}
