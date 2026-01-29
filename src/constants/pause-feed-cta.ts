import {ButtonColor} from '#/components/Button'

export type PauseFeedCTA = {
  id: string
  message: string
  buttonText: string
  buttonColor?: ButtonColor
  url: string
  frequency: number // e.g., 0.3 for 30%
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

export const FEED_PAUSE_CTAS: PauseFeedCTA[] = [
  {
    id: 'discord',
    message:
      'Join the Speakeasy team on Discord and help shape the future of Speakeasy',
    buttonText: 'Join us!',
    buttonColor: 'secondary_inverted',
    url: 'https://discord.gg/zn7nhZF3NB',
    frequency: 0.3,
    dateRange: {start: '2026-01-28', end: '2026-02-28'},
  },
  // Need to complete donations before this can be added
  // {
  //   id: 'donate',
  //   message: `Looks like you're enjoying Speakeasy!
  // \nWe're 100% user funded.
  // \nHelp us keep building the social media we all deserve.`,
  //   buttonText: 'Donate',
  //   buttonColor: 'bluesky',
  //   url: '/donate',
  //   frequency: 0.2,
  //   maxDisplays: 10,
  //   cooldownDays: 90,
  // },
]
