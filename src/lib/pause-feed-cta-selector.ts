import {CTADisplayStats} from '#/state/preferences/pause-feed-cta-stats'
import {FEED_PAUSE_CTAS, PauseFeedCTA} from '#/constants/pause-feed-cta'

const ROLLING_WINDOW_SIZE = 30

/**
 * Selects which CTA to show based on current stats.
 * Returns 'onboarding' for first-time users, 'default' for pauses 2-4,
 * and a feed pause CTA or 'default' for pauses 5+.
 */
export function selectCTA(
  stats: CTADisplayStats,
  hasSeenOnboarding: boolean,
): PauseFeedCTA | 'onboarding' | 'default' {
  // First pause: show onboarding if not seen
  if (stats.totalPausesDisplayed === 0 && !hasSeenOnboarding) {
    return 'onboarding'
  }

  // Pauses 2-4 (totalPausesDisplayed 1-3): show default
  if (stats.totalPausesDisplayed < 4) {
    return 'default'
  }

  // Pauses 5+: try to show a feed pause CTA
  const eligible = FEED_PAUSE_CTAS.filter(cta => isEligible(cta, stats))

  if (eligible.length === 0) {
    return 'default'
  }

  const selected = semiRandomlySelect(eligible, stats.recentDisplays)
  return selected || 'default'
}

/**
 * Gets the list of eligible feed pause CTA IDs based on current stats.
 */
export function getEligibleCTAs(stats: CTADisplayStats): string[] {
  return FEED_PAUSE_CTAS.filter(cta => isEligible(cta, stats)).map(
    cta => cta.id,
  )
}

/**
 * Checks if a CTA is eligible to be shown based on date range,
 * max displays, and cooldown.
 */
function isEligible(cta: PauseFeedCTA, stats: CTADisplayStats): boolean {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Check date range
  if (cta.dateRange) {
    // Calculate default dates relative to today
    const lastYear = new Date(now)
    lastYear.setFullYear(lastYear.getFullYear() - 1)
    const defaultStart = lastYear.toISOString().split('T')[0]

    const nextYear = new Date(now)
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const defaultEnd = nextYear.toISOString().split('T')[0]

    const start = cta.dateRange.start ?? defaultStart
    const end = cta.dateRange.end ?? defaultEnd

    if (today < start || today > end) {
      return false
    }
  }

  // Check max displays and cooldown
  if (cta.maxDisplays !== undefined) {
    const displayCount = stats.displayCounts[cta.id] || 0
    const cooldownStart = stats.cooldownStarted[cta.id]

    // If we've reached max displays
    if (displayCount >= cta.maxDisplays) {
      // Check if cooldown has expired
      if (cta.cooldownDays !== undefined && cooldownStart !== undefined) {
        const cooldownMs = cta.cooldownDays * 24 * 60 * 60 * 1000
        if (now.getTime() - cooldownStart >= cooldownMs) {
          // Cooldown expired - CTA is eligible again
          // Note: display count will be reset when recorded
          return true
        }
      }
      return false
    }
  }

  return true
}

/**
 * Selects a CTA using adjusted probabilities to correct toward target frequencies.
 * Returns null if no CTA should be shown (fall back to default).
 */
function semiRandomlySelect(
  eligible: PauseFeedCTA[],
  recentDisplays: Array<{ctaId: string; eligibleCTAs: string[]}>,
): PauseFeedCTA | null {
  if (eligible.length === 0) return null

  const relevantDisplays = recentDisplays.slice(-ROLLING_WINDOW_SIZE)

  // Count actual displays where each CTA was eligible
  const actualCounts: Record<string, number> = {}
  // Count how many periods each CTA was eligible
  const eligiblePeriodCounts: Record<string, number> = {}

  for (const display of relevantDisplays) {
    // Count displays: if a feed pause CTA was displayed, count it
    // (if it was displayed, it must have been eligible at selection time)
    if (display.ctaId !== 'default' && display.ctaId !== 'onboarding') {
      actualCounts[display.ctaId] = (actualCounts[display.ctaId] || 0) + 1
    }
    // Count periods where each CTA was eligible
    for (const ctaId of display.eligibleCTAs) {
      eligiblePeriodCounts[ctaId] = (eligiblePeriodCounts[ctaId] || 0) + 1
    }
  }

  // Calculate adjustment factors for each eligible CTA
  const adjustedProbabilities = eligible.map(cta => {
    const eligiblePeriods = eligiblePeriodCounts[cta.id] || 0
    const targetCount = cta.frequency * eligiblePeriods
    const actualCount = actualCounts[cta.id] || 0
    const deficit = targetCount - actualCount

    // Boost probability proportionally to deficit
    // If under-represented, boost; if over-represented, reduce
    // Use eligiblePeriods instead of windowSize for normalization
    const adjustmentFactor =
      eligiblePeriods > 0 ? 1 + deficit / Math.max(eligiblePeriods, 1) : 1

    return {
      cta,
      adjustedFreq: Math.max(0, cta.frequency * adjustmentFactor),
    }
  })

  // Calculate total adjusted frequency
  const totalAdjustedFreq = adjustedProbabilities.reduce(
    (sum, p) => sum + p.adjustedFreq,
    0,
  )

  // If total frequency is very low, likely no CTA should be shown
  if (totalAdjustedFreq <= 0) return null

  // Random selection with adjusted probabilities
  const prob = Math.random()
  let cumulative = 0

  for (const {cta, adjustedFreq} of adjustedProbabilities) {
    // Normalize the frequency relative to total
    cumulative += adjustedFreq / totalAdjustedFreq

    // But also check against the raw probability threshold
    // This ensures we still respect the overall frequency target
    if (prob < cumulative && Math.random() < totalAdjustedFreq) {
      return cta
    }
  }

  return null
}

/**
 * Checks if a CTA's cooldown should be reset and returns updated stats.
 * Call this when recording a display to reset counts after cooldown expires.
 */
export function resetCooldownIfExpired(
  ctaId: string,
  stats: CTADisplayStats,
  cta: PauseFeedCTA,
): CTADisplayStats {
  if (cta.maxDisplays === undefined || cta.cooldownDays === undefined) {
    return stats
  }

  const displayCount = stats.displayCounts[ctaId] || 0
  const cooldownStart = stats.cooldownStarted[ctaId]

  if (displayCount >= cta.maxDisplays && cooldownStart !== undefined) {
    const cooldownMs = cta.cooldownDays * 24 * 60 * 60 * 1000
    if (Date.now() - cooldownStart >= cooldownMs) {
      // Reset the display count
      return {
        ...stats,
        displayCounts: {
          ...stats.displayCounts,
          [ctaId]: 0,
        },
        cooldownStarted: {
          ...stats.cooldownStarted,
          [ctaId]: undefined as unknown as number,
        },
      }
    }
  }

  return stats
}

/**
 * Marks the start of a cooldown period for a CTA.
 * Call this when a CTA reaches its maxDisplays.
 */
export function startCooldownIfNeeded(
  ctaId: string,
  stats: CTADisplayStats,
  cta: PauseFeedCTA,
): CTADisplayStats {
  if (cta.maxDisplays === undefined || cta.cooldownDays === undefined) {
    return stats
  }

  const displayCount = stats.displayCounts[ctaId] || 0

  if (displayCount >= cta.maxDisplays && !stats.cooldownStarted[ctaId]) {
    return {
      ...stats,
      cooldownStarted: {
        ...stats.cooldownStarted,
        [ctaId]: Date.now(),
      },
    }
  }

  return stats
}
