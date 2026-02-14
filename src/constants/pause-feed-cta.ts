import {ButtonColor} from '#/components/Button'

// Set to a CTA id (e.g. 'donate') to bypass timing and selection in dev mode
export const DEBUG_FEED_PAUSE: string | null = null

// Simple CTAs: rendering defined in JSON
type SimplePauseFeedCTA = {
  id: string
  message: string
  buttonText: string
  buttonColor?: ButtonColor
  url: string
  frequency: number
  dateRange?: {start?: string; end?: string}
  maxDisplays?: number
  cooldownDays?: number
}

// Component CTAs: rendering defined in TSX, JSON is selection-only
type ComponentPauseFeedCTA = {
  id: string
  component: string
  frequency: number
  dateRange?: {start?: string; end?: string}
  maxDisplays?: number
  cooldownDays?: number
}

// | 'secondary_inverted'
// | 'negative'
// | 'gradient_primary'
// | 'gradient_sky'
// | 'gradient_midnight'
// | 'gradient_sunrise'
// | 'gradient_sunset'
// | 'gradient_nordic'
// | 'gradient_bonfire'
export type PauseFeedCTA = SimplePauseFeedCTA | ComponentPauseFeedCTA

export function isSimplePauseFeedCTA(
  cta: PauseFeedCTA,
): cta is SimplePauseFeedCTA {
  return 'message' in cta
}

export function isDonateCTA(cta: PauseFeedCTA): cta is ComponentPauseFeedCTA {
  return 'component' in cta && cta.component === 'donate'
}

export const FEED_PAUSE_CTAS: PauseFeedCTA[] = [
  {
    id: 'discord',
    message:
      'Finished scrolling?\n\nWhy not join the Speakeasy team on Discord and help shape the future of Speakeasy',
    buttonText: 'Join us!',
    buttonColor: 'secondary_inverted',
    url: 'https://discord.gg/zn7nhZF3NB',
    frequency: 0.3,
    dateRange: {start: '2026-01-28', end: '2026-02-28'},
  },
  // Need to complete donations before this can be added
  // {
  //   id: 'donate',
  //   component: 'donate',
  //   frequency: 0.2,
  //   maxDisplays: 10,
  //   cooldownDays: 90,
  // },
]
