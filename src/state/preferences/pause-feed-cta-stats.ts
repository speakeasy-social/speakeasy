import {z} from 'zod'

import {load, save} from '#/lib/storage'

const PAUSE_FEED_CTA_STATS_KEY = 'pause-feed-cta-stats'

const ctaDisplayStatsSchema = z.object({
  totalPausesDisplayed: z.number(),
  displayCounts: z.record(z.string(), z.number()),
  cooldownStarted: z.record(z.string(), z.number()),
  recentDisplays: z.array(
    z.object({
      ctaId: z.string(),
      eligibleCTAs: z.array(z.string()),
    }),
  ),
})

export type CTADisplayStats = z.infer<typeof ctaDisplayStatsSchema>

function createDefaultStats(): CTADisplayStats {
  return {
    totalPausesDisplayed: 0,
    displayCounts: {},
    cooldownStarted: {},
    recentDisplays: [],
  }
}

export async function loadCTAStats(): Promise<CTADisplayStats> {
  const data = await load(PAUSE_FEED_CTA_STATS_KEY)
  if (!data) return createDefaultStats()

  const parsed = ctaDisplayStatsSchema.safeParse(data)
  if (parsed.success) {
    return parsed.data
  }
  return createDefaultStats()
}

export async function saveCTAStats(stats: CTADisplayStats): Promise<void> {
  await save(PAUSE_FEED_CTA_STATS_KEY, stats)
}

export async function recordCTADisplay(
  ctaId: string,
  stats: CTADisplayStats,
  eligibleCTAs: string[] = [],
): Promise<CTADisplayStats> {
  const updatedStats = {...stats}

  // Increment total pauses displayed
  updatedStats.totalPausesDisplayed += 1

  // Increment display count for this CTA
  updatedStats.displayCounts = {
    ...updatedStats.displayCounts,
    [ctaId]: (updatedStats.displayCounts[ctaId] || 0) + 1,
  }

  // Add to recent displays (keep last 30)
  updatedStats.recentDisplays = [
    ...updatedStats.recentDisplays,
    {ctaId, eligibleCTAs},
  ].slice(-30)

  await saveCTAStats(updatedStats)
  return updatedStats
}
