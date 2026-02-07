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
import {Testimonial} from './types'

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

  // Dedupe contributions by (contribution, recognition) pair
  const seen = new Set<string>()
  const uniqueContributions = contributions.filter(c => {
    const key = `${c.contribution}:${c.public?.recognition ?? ''}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

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
              <UserAvatar size={42} avatar={author.avatar} type="user" />
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

            {uniqueContributions.length > 0 && (
              <View style={styles.badges}>
                {uniqueContributions.map((c, idx) => (
                  <SupporterBadge
                    key={`${c.contribution}:${
                      c.public?.recognition ?? ''
                    }:${idx}`}
                    contribution={c.contribution}
                    recognition={c.public?.recognition}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.messageContainer}>
            <Text style={[a.text_md, a.leading_snug, t.atoms.text]}>
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
    gap: 4,
  },
  messageContainer: {
    marginTop: 4,
  },
})
