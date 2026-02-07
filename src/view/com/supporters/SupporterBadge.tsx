import {Tag, TagVariant} from '#/components/Tag'

/**
 * Maps (contribution, recognition) to display variant and label
 */
function getBadgeStyle(
  contribution: string,
  recognition?: string | null,
): {variant: TagVariant; label: string} | null {
  // Special case: donor with "Founding Donor" recognition
  if (contribution === 'donor' && recognition === 'Founding Donor') {
    return {
      variant: 'gold',
      label: '✊ Founding Donor',
    }
  }

  // Map contribution strings to badge styles
  const contributionMap: Record<string, {variant: TagVariant; label: string}> =
    {
      donor: {
        variant: 'gradient_summer',
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

  return contributionMap[contribution] ?? null
}

export function SupporterBadge({
  contribution,
  recognition,
}: {
  contribution: string
  recognition?: string | null
}) {
  const style = getBadgeStyle(contribution, recognition)
  if (!style) {
    return null
  }
  return <Tag variant={style.variant} label={style.label} />
}
