import {RelationshipPriority, Testimonial} from './types'

export const mockTestimonials: Testimonial[] = [
  {
    id: '1',
    author: {
      did: 'did:plc:self123',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: undefined,
    },
    message:
      'Speakeasy has completely changed how I experience social media. The trust-based connections make every interaction feel meaningful.',
    badges: ['founder'],
    relationship: 'self',
  },
  {
    id: '2',
    author: {
      did: 'did:plc:trusts-me456',
      handle: 'bob.bsky.social',
      displayName: 'Bob',
      avatar: undefined,
    },
    message:
      'Finally, a platform where I can share privately with people I actually trust. The founder tier was a no-brainer.',
    badges: ['founder'],
    relationship: 'trusts-me',
  },
  {
    id: '3',
    author: {
      did: 'did:plc:i-trust789',
      handle: 'carol.bsky.social',
      displayName: 'Carol',
      avatar: undefined,
    },
    message:
      "As a supporter, I'm excited to see where this goes. Private posts are game-changing.",
    badges: ['supporter'],
    relationship: 'i-trust',
  },
  {
    id: '4',
    author: {
      did: 'did:plc:i-follow101',
      handle: 'dave.bsky.social',
      displayName: 'Dave',
      avatar: undefined,
    },
    message:
      'Love the contributor benefits. Being part of this community from the early days feels special.',
    badges: ['contributor'],
    relationship: 'i-follow',
  },
  {
    id: '5',
    author: {
      did: 'did:plc:follows-me202',
      handle: 'eve.bsky.social',
      displayName: 'Eve',
      avatar: undefined,
    },
    message:
      'The focus on genuine connections over viral content is refreshing. Happy to support this vision.',
    badges: ['supporter', 'contributor'],
    relationship: 'follows-me',
  },
  {
    id: '6',
    author: {
      did: 'did:plc:other303',
      handle: 'frank.bsky.social',
      displayName: 'Frank',
      avatar: undefined,
    },
    message:
      'Social media that respects privacy and fosters real trust? Sign me up. Proud founder here.',
    badges: ['founder'],
    relationship: 'other',
  },
  {
    id: '7',
    author: {
      did: 'did:plc:other404',
      handle: 'grace.bsky.social',
      displayName: 'Grace',
      avatar: undefined,
    },
    message:
      'Been looking for something like this for years. The supporter tier gives me access to exactly what I need.',
    badges: ['supporter'],
    relationship: 'other',
  },
]

const RELATIONSHIP_ORDER: Record<RelationshipPriority, number> = {
  self: 0,
  'trusts-me': 1,
  'i-trust': 2,
  'i-follow': 3,
  'follows-me': 4,
  other: 5,
}

export function sortTestimonialsByRelationship(
  testimonials: Testimonial[],
): Testimonial[] {
  return [...testimonials].sort((a, b) => {
    return (
      RELATIONSHIP_ORDER[a.relationship] - RELATIONSHIP_ORDER[b.relationship]
    )
  })
}
