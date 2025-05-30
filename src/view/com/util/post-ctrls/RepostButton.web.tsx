import React from 'react'
import {Pressable, View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {putPrivateRepost} from '#/lib/api/private-repost'
import {usePrivateSession} from '#/lib/api/private-sessions'
import {useAgent, useRequireAuth, useSession} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {CloseQuote_Stroke2_Corner1_Rounded as Quote} from '#/components/icons/Quote'
import {Repost_Stroke2_Corner2_Rounded as Repost} from '#/components/icons/Repost'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {EventStopper} from '../EventStopper'
import {formatCount} from '../numeric/format'

interface Props {
  isReposted: boolean
  repostCount?: number
  onRepost: () => void
  onQuote: () => void
  big?: boolean
  embeddingDisabled: boolean
  isPrivatePost: boolean
  post: {
    uri: string
    cid: string
    langs?: string[]
  }
}

export const RepostButton = ({
  isReposted,
  repostCount,
  onRepost,
  onQuote,
  big,
  embeddingDisabled,
  isPrivatePost,
  post,
}: Props) => {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession} = useSession()
  const requireAuth = useRequireAuth()
  const agent = useAgent()
  const getPrivateSession = usePrivateSession()

  const color = React.useMemo(
    () => ({
      color: isReposted ? t.palette.positive_600 : t.palette.contrast_500,
    }),
    [t, isReposted],
  )

  const onRepostPrivate = React.useCallback(async () => {
    try {
      const {sessionId, sessionKey} = await getPrivateSession({
        onStateChange: () => {},
      })
      await putPrivateRepost(agent, post, sessionId, sessionKey)
      Toast.show(_(msg`Reposted to trusted`))
    } catch (err) {
      console.error('Failed to repost', err)
      Toast.show(_(msg`Failed to repost`), 'exclamation-circle')
    }
  }, [agent, post, getPrivateSession, _])

  return hasSession ? (
    <EventStopper onKeyDown={false}>
      <Menu.Root>
        <Menu.Trigger label={_(msg`Repost or quote post`)}>
          {({props, state}) => {
            return (
              <Pressable
                {...props}
                style={[
                  a.rounded_full,
                  (state.hovered || state.pressed) && {
                    backgroundColor: t.palette.contrast_25,
                  },
                ]}>
                <RepostInner
                  isReposted={isReposted}
                  color={color}
                  repostCount={repostCount}
                  big={big}
                />
              </Pressable>
            )
          }}
        </Menu.Trigger>
        <Menu.Outer style={{minWidth: 170}}>
          {!isPrivatePost && (
            <Menu.Item
              label={isReposted ? _(msg`Undo repost`) : _(msg`Repost`)}
              testID="repostDropdownRepostBtn"
              onPress={onRepost}>
              <Menu.ItemText>
                {isReposted ? _(msg`Undo repost`) : _(msg`Repost`)}
              </Menu.ItemText>
              <Menu.ItemIcon icon={Repost} position="right" />
            </Menu.Item>
          )}
          {!isReposted && (
            <Menu.Item
              label={_(msg`Repost to Trusted`)}
              testID="repostDropdownRepostBtn"
              onPress={onRepostPrivate}>
              <Menu.ItemText>{_(msg`Repost to Trusted`)}</Menu.ItemText>
              <Menu.ItemIcon icon={Repost} position="right" />
            </Menu.Item>
          )}
          <Menu.Item
            disabled={embeddingDisabled}
            label={
              embeddingDisabled
                ? _(msg`Quote posts disabled`)
                : _(msg`Quote post`)
            }
            testID="repostDropdownQuoteBtn"
            onPress={onQuote}>
            <Menu.ItemText>
              {embeddingDisabled
                ? _(msg`Quote posts disabled`)
                : _(msg`Quote post`)}
            </Menu.ItemText>
            <Menu.ItemIcon icon={Quote} position="right" />
          </Menu.Item>
        </Menu.Outer>
      </Menu.Root>
    </EventStopper>
  ) : (
    <Button
      onPress={() => {
        requireAuth(() => {})
      }}
      label={_(msg`Repost or quote post`)}
      style={{padding: 0}}
      hoverStyle={t.atoms.bg_contrast_25}
      shape="round">
      <RepostInner
        isReposted={isReposted}
        color={color}
        repostCount={repostCount}
        big={big}
      />
    </Button>
  )
}

const RepostInner = ({
  isReposted,
  color,
  repostCount,
  big,
}: {
  isReposted: boolean
  color: {color: string}
  repostCount?: number
  big?: boolean
}) => {
  const {i18n} = useLingui()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs, {padding: 5}]}>
      <Repost style={color} width={big ? 22 : 18} />
      {typeof repostCount !== 'undefined' && repostCount > 0 ? (
        <Text
          testID="repostCount"
          style={[
            color,
            big ? a.text_md : {fontSize: 15},
            isReposted && [a.font_bold],
            a.user_select_none,
          ]}>
          {formatCount(i18n, repostCount)}
        </Text>
      ) : undefined}
    </View>
  )
}
