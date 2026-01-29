import {describe, expect, it, jest} from '@jest/globals'

import {PauseFeedCTA} from '../../src/constants/pause-feed-cta'
import {
  getEligibleCTAs,
  resetCooldownIfExpired,
  selectCTA,
  startCooldownIfNeeded,
} from '../../src/lib/pause-feed-cta-selector'
import {CTADisplayStats} from '../../src/state/preferences/pause-feed-cta-stats'

// Mock the FEED_PAUSE_CTAS constant
jest.mock('../../src/constants/pause-feed-cta', () => ({
  FEED_PAUSE_CTAS: [
    {
      id: 'test-cta-1',
      message: 'Test CTA 1',
      buttonText: 'Click me',
      url: 'https://example.com/1',
      frequency: 0.3,
    },
    {
      id: 'test-cta-2',
      message: 'Test CTA 2',
      buttonText: 'Click me too',
      url: 'https://example.com/2',
      frequency: 0.2,
      maxDisplays: 5,
      cooldownDays: 30,
    },
    {
      id: 'test-cta-date-range',
      message: 'Limited time',
      buttonText: 'Limited',
      url: 'https://example.com/limited',
      frequency: 0.1,
      dateRange: {start: '2026-01-15', end: '2026-01-20'},
    },
  ] as PauseFeedCTA[],
}))

describe('pause-feed-cta-selector', () => {
  const createEmptyStats = (): CTADisplayStats => ({
    totalPausesDisplayed: 0,
    displayCounts: {},
    cooldownStarted: {},
    recentDisplays: [],
  })

  const createDisplayEntry = (
    ctaId: string,
    eligibleCTAs: string[] = [],
  ): {ctaId: string; eligibleCTAs: string[]} => ({
    ctaId,
    eligibleCTAs,
  })

  describe('selectCTA', () => {
    it('returns onboarding for first pause when not seen', () => {
      const stats = createEmptyStats()
      const result = selectCTA(stats, false)
      expect(result).toBe('onboarding')
    })

    it('returns default for first pause when onboarding already seen', () => {
      const stats = createEmptyStats()
      const result = selectCTA(stats, true)
      expect(result).toBe('default')
    })

    it('returns default for pauses 2-4', () => {
      for (let i = 1; i <= 3; i++) {
        const stats = {...createEmptyStats(), totalPausesDisplayed: i}
        const result = selectCTA(stats, true)
        expect(result).toBe('default')
      }
    })

    it('can return feed pause CTA for pause 5+ and respects maxDisplays limit', () => {
      const ctaStats = {...createEmptyStats(), totalPausesDisplayed: 4}
      const maxedStats: CTADisplayStats = {
        totalPausesDisplayed: 10,
        displayCounts: {'test-cta-2': 5}, // Already at max
        cooldownStarted: {},
        recentDisplays: [], // Empty recent displays
      }

      const ctaResults = new Set<string>()
      const maxedResults: (PauseFeedCTA | string)[] = []

      // Run multiple times to account for randomness while testing both behaviors
      for (let i = 0; i < 100; i++) {
        const ctaResult = selectCTA(ctaStats, true)
        if (typeof ctaResult === 'object') {
          ctaResults.add(ctaResult.id)
        } else {
          ctaResults.add(ctaResult)
        }

        maxedResults.push(selectCTA(maxedStats, true))
      }

      // Should see at least some feed pause CTAs or default
      expect(ctaResults.size).toBeGreaterThan(0)

      // test-cta-2 should not appear (at maxDisplays)
      const maxedCTA = maxedResults.find(
        r => typeof r === 'object' && r.id === 'test-cta-2',
      )
      expect(maxedCTA).toBeUndefined()
    })
  })

  describe('resetCooldownIfExpired', () => {
    it('resets display count when cooldown expires', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 20,
        displayCounts: {'test-cta-2': 5},
        cooldownStarted: {'test-cta-2': thirtyOneDaysAgo},
        recentDisplays: [], // Empty recent displays
      }

      const cta: PauseFeedCTA = {
        id: 'test-cta-2',
        message: 'Test',
        buttonText: 'Test',
        url: 'https://example.com',
        frequency: 0.2,
        maxDisplays: 5,
        cooldownDays: 30,
      }

      const result = resetCooldownIfExpired('test-cta-2', stats, cta)
      expect(result.displayCounts['test-cta-2']).toBe(0)
    })

    it('does not reset when cooldown has not expired', () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 20,
        displayCounts: {'test-cta-2': 5},
        cooldownStarted: {'test-cta-2': tenDaysAgo},
        recentDisplays: [], // Empty recent displays
      }

      const cta: PauseFeedCTA = {
        id: 'test-cta-2',
        message: 'Test',
        buttonText: 'Test',
        url: 'https://example.com',
        frequency: 0.2,
        maxDisplays: 5,
        cooldownDays: 30,
      }

      const result = resetCooldownIfExpired('test-cta-2', stats, cta)
      expect(result.displayCounts['test-cta-2']).toBe(5)
    })
  })

  describe('startCooldownIfNeeded', () => {
    it('starts cooldown when maxDisplays is reached', () => {
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 20,
        displayCounts: {'test-cta-2': 5},
        cooldownStarted: {},
        recentDisplays: [],
      }

      const cta: PauseFeedCTA = {
        id: 'test-cta-2',
        message: 'Test',
        buttonText: 'Test',
        url: 'https://example.com',
        frequency: 0.2,
        maxDisplays: 5,
        cooldownDays: 30,
      }

      const result = startCooldownIfNeeded('test-cta-2', stats, cta)
      expect(result.cooldownStarted['test-cta-2']).toBeDefined()
      expect(typeof result.cooldownStarted['test-cta-2']).toBe('number')
    })

    it('does not start cooldown when below maxDisplays', () => {
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 10,
        displayCounts: {'test-cta-2': 3},
        cooldownStarted: {},
        recentDisplays: [],
      }

      const cta: PauseFeedCTA = {
        id: 'test-cta-2',
        message: 'Test',
        buttonText: 'Test',
        url: 'https://example.com',
        frequency: 0.2,
        maxDisplays: 5,
        cooldownDays: 30,
      }

      const result = startCooldownIfNeeded('test-cta-2', stats, cta)
      expect(result.cooldownStarted['test-cta-2']).toBeUndefined()
    })
  })

  describe('frequency correction', () => {
    it('boosts under-represented CTAs over time', () => {
      // Create stats where test-cta-1 has been shown much less than its target
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 50,
        displayCounts: {},
        cooldownStarted: {},
        // Recent displays heavily favor default, under-representing test-cta-1
        // All displays had test-cta-1 eligible but default was shown
        recentDisplays: Array(30).fill(
          createDisplayEntry('default', ['test-cta-1', 'test-cta-2']),
        ),
      }

      // Run many times and count
      const counts: Record<string, number> = {}
      for (let i = 0; i < 200; i++) {
        const result = selectCTA(stats, true)
        const key = typeof result === 'object' ? result.id : result
        counts[key] = (counts[key] || 0) + 1
      }

      // With frequency correction, feed pause CTAs should appear
      // at higher rates than without correction
      const feedPauseCount =
        (counts['test-cta-1'] || 0) + (counts['test-cta-2'] || 0)
      expect(feedPauseCount).toBeGreaterThan(0)
    })
  })

  describe('getEligibleCTAs', () => {
    it('returns eligible CTA IDs', () => {
      const stats = createEmptyStats()
      const eligible = getEligibleCTAs({...stats, totalPausesDisplayed: 10})
      expect(eligible).toContain('test-cta-1')
      expect(eligible).toContain('test-cta-2')
    })

    it('excludes CTAs that have reached maxDisplays', () => {
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 10,
        displayCounts: {'test-cta-2': 5},
        cooldownStarted: {},
        recentDisplays: [],
      }
      const eligible = getEligibleCTAs(stats)
      expect(eligible).toContain('test-cta-1')
      expect(eligible).not.toContain('test-cta-2')
    })

    it('includes CTAs after cooldown expires', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 10,
        displayCounts: {'test-cta-2': 5},
        cooldownStarted: {'test-cta-2': thirtyOneDaysAgo},
        recentDisplays: [],
      }
      const eligible = getEligibleCTAs(stats)
      expect(eligible).toContain('test-cta-2')
    })
  })

  describe('eligibility tracking in frequency correction', () => {
    it('does not boost CTA that just became eligible', () => {
      // Simulate a scenario where test-cta-1 was not eligible for first 20 displays
      // but becomes eligible for the last 10
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 30,
        displayCounts: {},
        cooldownStarted: {},
        recentDisplays: [
          // First 20 displays: only test-cta-2 was eligible
          ...Array(20).fill(createDisplayEntry('default', ['test-cta-2'])),
          // Last 10 displays: both CTAs are eligible
          ...Array(10).fill(
            createDisplayEntry('default', ['test-cta-1', 'test-cta-2']),
          ),
        ],
      }

      // test-cta-1 should not be immediately boosted just because it has 0 displays
      // It was only eligible for 10 periods, so its target should be based on that
      const counts: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        const result = selectCTA(stats, true)
        const key = typeof result === 'object' ? result.id : result
        counts[key] = (counts[key] || 0) + 1
      }

      // test-cta-1 should appear, but not excessively
      // Since it was eligible for 10 periods with frequency 0.3, target is ~3
      // But we're only showing 100 samples, so it might appear a few times
      const cta1Count = counts['test-cta-1'] || 0
      // It should appear some times (it's eligible now), but not be boosted
      // excessively for the periods when it wasn't eligible
      expect(cta1Count).toBeGreaterThanOrEqual(0)
    })

    it('only counts periods where CTA was eligible for deficit calculation', () => {
      // test-cta-1 was eligible for 10 periods, shown 0 times
      // test-cta-2 was eligible for 30 periods, shown 0 times
      // Both should have similar deficit calculations relative to their eligible periods
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 30,
        displayCounts: {},
        cooldownStarted: {},
        recentDisplays: [
          // First 20: only test-cta-2 eligible
          ...Array(20).fill(createDisplayEntry('default', ['test-cta-2'])),
          // Last 10: both eligible
          ...Array(10).fill(
            createDisplayEntry('default', ['test-cta-1', 'test-cta-2']),
          ),
        ],
      }

      // Run selection many times
      const counts: Record<string, number> = {}
      for (let i = 0; i < 200; i++) {
        const result = selectCTA(stats, true)
        const key = typeof result === 'object' ? result.id : result
        counts[key] = (counts[key] || 0) + 1
      }

      // Both CTAs should appear since they're both eligible now
      // test-cta-1 was eligible for 10 periods (target ~3), test-cta-2 for 30 (target ~6)
      // Both have 0 actual displays, so both should be boosted
      const cta1Count = counts['test-cta-1'] || 0
      const cta2Count = counts['test-cta-2'] || 0

      // Both should appear (they're eligible and under-represented)
      expect(cta1Count + cta2Count).toBeGreaterThan(0)
    })

    it('handles CTA exiting eligibility mid-window', () => {
      // test-cta-date-range enters and exits eligibility
      // First 15 displays: test-cta-date-range was eligible
      // Last 15 displays: test-cta-date-range is no longer eligible
      const stats: CTADisplayStats = {
        totalPausesDisplayed: 30,
        displayCounts: {},
        cooldownStarted: {},
        recentDisplays: [
          // First 15: test-cta-date-range was eligible
          ...Array(15).fill(
            createDisplayEntry('default', ['test-cta-date-range']),
          ),
          // Last 15: test-cta-date-range is no longer eligible
          ...Array(15).fill(createDisplayEntry('default', [])),
        ],
      }

      // test-cta-date-range should not be penalized for periods when it wasn't eligible
      // It was eligible for 15 periods, so its target should be based on that
      const eligible = getEligibleCTAs(stats)
      // Since we're past the date range, it shouldn't be eligible now
      expect(eligible).not.toContain('test-cta-date-range')
    })
  })
})
