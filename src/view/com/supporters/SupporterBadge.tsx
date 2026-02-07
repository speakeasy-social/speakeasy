import {capitalize} from '#/lib/strings/capitalize'
import {Tag, TagVariant} from '#/components/Tag'

/**
 * Maps (contribution, recognition, isRegularGift) to display variant and label
 */
function getBadgeStyle(
  contribution: string,
  recognition?: string | null,
  isRegularGift?: boolean,
): {variant: TagVariant; label: string} {
  // Special case: donor with "Founding Donor" recognition
  if (contribution === 'donor' && recognition === 'Founding Donor') {
    return {
      variant: 'gold',
      label: '✊ Founding Donor',
    }
  }

  // Regular (recurring) donor: use a distinct colour
  if (contribution === 'donor' && isRegularGift) {
    return {
      variant: 'gradient_nordic',
      label: '☀️ Donor',
    }
  }

  // Map contribution strings to badge styles
  const contributionMap: Record<string, {variant: TagVariant; label: string}> =
    {
      donor: {
        variant: 'silver',
        label: '☀️ Donor',
      },
      contributor: {
        variant: 'bronze',
        label: '⚒️ Contributor',
      },
      designer: {
        variant: 'violet',
        label: '🎨 Design',
      },
      engineer: {
        variant: 'blue',
        label: '🔨 Code',
      },
      testing: {
        variant: 'emerald',
        label: '👷 Testing & QA',
      },
    }

  return (
    contributionMap[contribution] ?? {
      variant: 'silver',
      label: capitalize(contribution.replace(/_/g, ' ')),
    }
  )
}

export function SupporterBadge({
  contribution,
  recognition,
  isRegularGift,
}: {
  contribution: string
  recognition?: string | null
  isRegularGift?: boolean
}) {
  const style = getBadgeStyle(contribution, recognition, isRegularGift)
  return <Tag variant={style.variant} label={style.label} />
}
