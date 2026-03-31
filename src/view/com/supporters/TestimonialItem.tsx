import {memo} from 'react'
import {StyleSheet, View} from 'react-native'

import {usePalette} from '#/lib/hooks/usePalette'
import {makeProfileLink} from '#/lib/routes/links'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {Text} from '#/components/Typography'
import {SupporterBadge} from './SupporterBadge'
import {deduplicateContributions, Testimonial} from './types'

interface TestimonialItemProps {
  testimonial: Testimonial
}

export const TestimonialItem = memo(function TestimonialItem({
  testimonial,
}: TestimonialItemProps) {
  const pal = usePalette('default')
  const t = useTheme()
  const {author, message, contributions} = testimonial

  const profileLink = makeProfileLink({
    did: author.did,
    handle: author.handle,
  })

  const displayName = author.displayName
    ? sanitizeDisplayName(author.displayName)
    : sanitizeHandle(author.handle)

  const uniqueContributions = deduplicateContributions(contributions)

  return (
    <View
      style={[
        styles.outer,
        {
          borderBottomColor: pal.colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <View style={styles.layout}>
        <View style={styles.avatarContainer}>
          <ProfileHoverCard did={author.did}>
            <Link
              label={`${displayName}'s avatar`}
              accessibilityHint="Opens this profile"
              to={profileLink}>
              <UserAvatar
                size={42}
                avatar={author.avatar}
                dek={author.dek}
                type="user"
              />
            </Link>
          </ProfileHoverCard>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <ProfileHoverCard did={author.did}>
              <Link
                label={`View ${displayName}'s profile`}
                to={profileLink}
                style={a.flex_shrink}>
                <Text
                  emoji
                  style={[a.text_md, a.font_bold, a.leading_tight]}
                  numberOfLines={1}>
                  {displayName}
                </Text>
              </Link>
            </ProfileHoverCard>

            {uniqueContributions.map((c, idx) => (
              <View
                key={`${c.contribution}:${c.public?.recognition ?? ''}:${idx}`}
                style={styles.badges}>
                <Text
                  style={[
                    a.text_md,
                    a.font_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {' · '}
                </Text>
                <SupporterBadge
                  contribution={c.contribution}
                  recognition={c.public?.recognition}
                  isRegularGift={c.public?.isRegularGift}
                />
              </View>
            ))}
          </View>

          <View style={styles.messageContainer}>
            <Text
              style={[
                a.text_md,
                a.leading_snug,
                t.atoms.text,
                {fontStyle: 'italic'},
              ]}>
              {message}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  layout: {
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageContainer: {
    marginTop: 4,
  },
})
