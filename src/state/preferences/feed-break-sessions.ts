import {z} from 'zod'

import {load, save} from '#/lib/storage'

const FEED_BREAK_SESSIONS_KEY = 'feed-break-sessions'

// Schema for tracking effectiveness of each posts-per-interrupt value
const interruptEffectivenessSchema = z.object({
  postsPerInterrupt: z.number(),
  weight: z.number(), // Between 0 and 1
  totalSessions: z.number(),
  totalPostsSeen: z.number(), // Running total of posts seen across all sessions
  lastSessionId: z.string().optional(), // Track the last session ID to avoid duplicates
})

const feedBreakSessionsSchema = z.array(interruptEffectivenessSchema)

type InterruptEffectiveness = z.infer<typeof interruptEffectivenessSchema>

// Constants for posts per interrupt
const MIN_POSTS = 20
const MAX_POSTS = 100
const POST_INCREMENT = 10
const MIN_WEIGHT = 0.05 // 5% minimum weight
const DEFAULT_WEIGHT = 0.1 // 10% weight as default

// Generate all possible posts-per-interrupt values
const POSSIBLE_POSTS_PER_INTERRUPT = Array.from(
  {length: (MAX_POSTS - MIN_POSTS) / POST_INCREMENT + 1},
  (_, i) => MIN_POSTS + i * POST_INCREMENT,
)

// Default posts per interrupt if we don't have enough history
export const DEFAULT_POSTS_PER_INTERRUPT = 50

// Initialize with equal weights
function initializeEffectiveness(): InterruptEffectiveness[] {
  const equalWeight = 1 / POSSIBLE_POSTS_PER_INTERRUPT.length
  return POSSIBLE_POSTS_PER_INTERRUPT.map(posts => ({
    postsPerInterrupt: posts,
    weight: equalWeight,
    totalSessions: 0,
    totalPostsSeen: 0,
  }))
}

export async function saveSessionStats(
  postsPerInterrupt: number,
  sessionId: string,
): Promise<void> {
  const stats = await loadEffectivenessStats()
  console.log('jesse-stats', stats)

  // Find the entry for this posts-per-interrupt value
  const entry = stats.find(s => s.postsPerInterrupt === postsPerInterrupt)
  if (!entry) return

  // Only count as a new session if this is a different session ID
  if (entry.lastSessionId !== sessionId) {
    // ensure we numbers don't get too big, by resetting it often, but keeping the average
    if (entry.totalSessions > 20) {
      entry.totalSessions = 1
      entry.totalPostsSeen = entry.totalPostsSeen / 20
    }

    entry.totalSessions++
    entry.lastSessionId = sessionId
  }

  // Always update the total posts seen
  entry.totalPostsSeen += postsPerInterrupt

  // Calculate new weights based on effectiveness (lower posts seen = more effective)
  const avgPostsSeen = stats.map(s => s.totalPostsSeen / (s.totalSessions || 1))
  const maxPostsSeen = Math.max(...avgPostsSeen)
  const minPostsSeen = Math.min(...avgPostsSeen)
  const range = maxPostsSeen - minPostsSeen

  // Update weights inversely proportional to average posts seen
  // More effective (fewer posts seen) = higher weight
  stats.forEach(s => {
    // if no data, just 10%
    if (s.totalSessions === 0) {
      s.weight = DEFAULT_WEIGHT
      return
    }
    const avgPosts = s.totalPostsSeen / s.totalSessions
    // Normalize to 0-1 range, then invert (1 - x) so lower posts = higher weight
    const normalizedEffectiveness =
      range === 0 ? 0.5 : 1 - (avgPosts - minPostsSeen) / range
    // Ensure minimum weight of 5%
    s.weight = Math.max(MIN_WEIGHT, normalizedEffectiveness)
  })

  // Normalize weights to sum to 1
  const totalWeight = stats.reduce((sum, s) => sum + s.weight, 0)
  stats.forEach(s => {
    s.weight = s.weight / totalWeight
  })

  await save(FEED_BREAK_SESSIONS_KEY, stats)
}

async function loadEffectivenessStats(): Promise<InterruptEffectiveness[]> {
  const data = await load(FEED_BREAK_SESSIONS_KEY)
  if (!data) return initializeEffectiveness()

  const parsed = feedBreakSessionsSchema.safeParse(data)
  if (parsed.success) {
    return parsed.data
  }
  return initializeEffectiveness()
}

export async function calculateNextPostsPerInterrupt(): Promise<number> {
  const stats = await loadEffectivenessStats()
  console.log('stats', stats)

  // Generate random number between 0 and 1
  const rand = Math.random()

  // Find which increment this random number falls into
  let cumulativeWeight = 0
  for (const stat of stats) {
    cumulativeWeight += stat.weight
    if (rand < cumulativeWeight) {
      return stat.postsPerInterrupt
    }
  }

  // Fallback to default if something goes wrong
  return DEFAULT_POSTS_PER_INTERRUPT
}

export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}
