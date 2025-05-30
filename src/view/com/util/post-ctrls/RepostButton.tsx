import React, {memo, useCallback} from 'react'
import {View} from 'react-native'
import {msg, plural, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {putPrivateRepost} from '#/lib/api/private-repost'
import {usePrivateSession} from '#/lib/api/private-sessions'
import {POST_CTRL_HITSLOP} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {useRequireAuth} from '#/state/session'
import {useAgent} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {CloseQuote_Stroke2_Corner1_Rounded as Quote} from '#/components/icons/Quote'
import {Repost_Stroke2_Corner2_Rounded as Repost} from '#/components/icons/Repost'
import {Text} from '#/components/Typography'
import {formatCount} from '../numeric/format'
import * as Toast from '../Toast'

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

let RepostButton = ({
  isReposted,
  repostCount,
  onRepost,
  onQuote,
  big,
  embeddingDisabled,
  isPrivatePost,
  post,
}: Props): React.ReactNode => {
  const t = useTheme()
  const {_, i18n} = useLingui()
  const requireAuth = useRequireAuth()
  const dialogControl = Dialog.useDialogControl()
  const playHaptic = useHaptics()
  const color = React.useMemo(
    () => ({
      color: isReposted ? t.palette.positive_600 : t.palette.contrast_500,
    }),
    [t, isReposted],
  )
  return (
    <>
      <Button
        testID="repostBtn"
        onPress={() => {
          playHaptic('Light')
          requireAuth(() => dialogControl.open())
        }}
        onLongPress={() => {
          playHaptic('Heavy')
          requireAuth(() => onQuote())
        }}
        style={[
          a.flex_row,
          a.align_center,
          a.gap_xs,
          a.bg_transparent,
          {padding: 5},
        ]}
        hoverStyle={t.atoms.bg_contrast_25}
        label={
          isReposted
            ? _(
                msg`Undo repost (${plural(repostCount || 0, {
                  one: '# repost',
                  other: '# reposts',
                })})`,
              )
            : _(
                msg`Repost (${plural(repostCount || 0, {
                  one: '# repost',
                  other: '# reposts',
                })})`,
              )
        }
        shape="round"
        variant="ghost"
        color="secondary"
        hitSlop={POST_CTRL_HITSLOP}>
        <Repost style={color} width={big ? 22 : 18} />
        {typeof repostCount !== 'undefined' && repostCount > 0 ? (
          <Text
            testID="repostCount"
            style={[
              color,
              big ? a.text_md : {fontSize: 15},
              isReposted && a.font_bold,
            ]}>
            {formatCount(i18n, repostCount)}
          </Text>
        ) : undefined}
      </Button>
      <Dialog.Outer
        control={dialogControl}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <RepostButtonDialogInner
          isReposted={isReposted}
          onRepost={onRepost}
          onQuote={onQuote}
          embeddingDisabled={embeddingDisabled}
          isPrivatePost={isPrivatePost}
          post={post}
        />
      </Dialog.Outer>
    </>
  )
}
RepostButton = memo(RepostButton)
export {RepostButton}

let RepostButtonDialogInner = ({
  isReposted,
  onRepost,
  onQuote,
  embeddingDisabled,
  isPrivatePost,
  post,
}: {
  isReposted: boolean
  onRepost: () => void
  onQuote: () => void
  embeddingDisabled: boolean
  isPrivatePost: boolean
  post: {
    uri: string
    cid: string
    langs?: string[]
  }
}): React.ReactNode => {
  const t = useTheme()
  const {_} = useLingui()
  const playHaptic = useHaptics()
  const control = Dialog.useDialogContext()
  const getPrivateSession = usePrivateSession()
  const agent = useAgent()

  const onPressRepost = useCallback(() => {
    if (!isReposted) playHaptic()

    control.close(() => {
      onRepost()
    })
  }, [control, isReposted, onRepost, playHaptic])

  const onPressRepostPrivate = useCallback(async () => {
    try {
      const {sessionId, sessionKey} = await getPrivateSession({
        onStateChange: () => {},
      })
      await putPrivateRepost(agent, post, sessionId, sessionKey)
      Toast.show(_(msg`Reposted to trusted`), 'check-circle')
      control.close()
    } catch (e) {
      Toast.show(_(msg`Failed to repost to trusted`), 'exclamation-circle')
    }
  }, [control, post, getPrivateSession, agent, _])

  const onPressQuote = useCallback(() => {
    playHaptic()
    control.close(() => {
      onQuote()
    })
  }, [control, onQuote, playHaptic])

  const onPressClose = useCallback(() => control.close(), [control])

  return (
    <Dialog.ScrollableInner label={_(msg`Repost or quote post`)}>
      <View style={a.gap_xl}>
        <View style={a.gap_xs}>
          {!isPrivatePost && (
            <Button
              style={[a.justify_start, a.px_md]}
              label={
                isReposted
                  ? _(msg`Remove repost`)
                  : _(msg({message: `Repost`, context: 'action'}))
              }
              onPress={onPressRepost}
              size="large"
              variant="ghost"
              color="primary">
              <Repost size="lg" fill={t.palette.primary_500} />
              <Text style={[a.font_bold, a.text_xl]}>
                {isReposted ? (
                  <Trans>Remove repost</Trans>
                ) : (
                  <Trans context="action">_(msg`Repost`)</Trans>
                )}
              </Text>
            </Button>
          )}
          <Button
            style={[a.justify_start, a.px_md]}
            label={
              isReposted
                ? _(msg`Remove repost`)
                : _(msg({message: `Repost`, context: 'action'}))
            }
            onPress={onPressRepostPrivate}
            size="large"
            variant="ghost"
            color="primary">
            <Repost size="lg" fill={t.palette.primary_500} />
            <Text style={[a.font_bold, a.text_xl]}>
              <Trans context="action">_(msg`Repost to Trusted`)</Trans>
            </Text>
          </Button>
          <Button
            disabled={embeddingDisabled}
            testID="quoteBtn"
            style={[a.justify_start, a.px_md]}
            label={
              embeddingDisabled
                ? _(msg`Quote posts disabled`)
                : _(msg`Quote post`)
            }
            onPress={onPressQuote}
            size="large"
            variant="ghost"
            color="primary">
            <Quote
              size="lg"
              fill={
                embeddingDisabled
                  ? t.atoms.text_contrast_low.color
                  : t.palette.primary_500
              }
            />
            <Text
              style={[
                a.font_bold,
                a.text_xl,
                embeddingDisabled && t.atoms.text_contrast_low,
              ]}>
              {embeddingDisabled ? (
                <Trans>Quote posts disabled</Trans>
              ) : (
                <Trans>Quote post</Trans>
              )}
            </Text>
          </Button>
        </View>
        <Button
          label={_(msg`Cancel quote post`)}
          onPress={onPressClose}
          size="large"
          variant="outline"
          color="primary">
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
      </View>
    </Dialog.ScrollableInner>
  )
}
RepostButtonDialogInner = memo(RepostButtonDialogInner)
export {RepostButtonDialogInner}
