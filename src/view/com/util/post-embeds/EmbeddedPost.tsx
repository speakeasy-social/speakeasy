import React from 'react'
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'
import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  ModerationDecision,
  RichText as RichTextAPI,
} from '@atproto/api'
import {AtUri} from '@atproto/api'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQueryClient} from '@tanstack/react-query'

import {HITSLOP_20} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {InfoCircleIcon} from '#/lib/icons'
import {moderatePost_wrapped as moderatePost} from '#/lib/moderatePost_wrapped'
import {makeProfileLink} from '#/lib/routes/links'
import {s} from '#/lib/styles'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {precacheProfile} from '#/state/queries/profile'
import {useResolveLinkQuery} from '#/state/queries/resolve-link'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {RichText} from '#/components/RichText'
import {SubtleWebHover} from '#/components/SubtleWebHover'
import {ContentHider} from '../../../../components/moderation/ContentHider'
import {PostAlerts} from '../../../../components/moderation/PostAlerts'
import {Link} from '../Link'
import {PostMeta} from '../PostMeta'
import {Text} from '../text/Text'
import {PostEmbeds} from '.'
import {QuoteEmbedViewContext} from './types'

export function MaybeEmbeddedPost({
  embed,
  onOpen,
  style,
  allowNestedQuotes,
  viewContext,
}: {
  embed: AppBskyEmbedRecord.View
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  allowNestedQuotes?: boolean
  viewContext?: QuoteEmbedViewContext
}) {
  const t = useTheme()
  const pal = usePalette('default')
  const {currentAccount} = useSession()
  if (
    AppBskyEmbedRecord.isViewRecord(embed.record) &&
    AppBskyFeedPost.isRecord(embed.record.value) &&
    AppBskyFeedPost.validateRecord(embed.record.value).success
  ) {
    return (
      <EmbeddedPostModerated
        viewRecord={embed.record}
        onOpen={onOpen}
        style={style}
        allowNestedQuotes={allowNestedQuotes}
        viewContext={viewContext}
      />
    )
  } else if (AppBskyEmbedRecord.isViewBlocked(embed.record)) {
    return (
      <View
        style={[styles.errorContainer, a.border, t.atoms.border_contrast_low]}>
        <InfoCircleIcon size={18} style={pal.text} />
        <Text type="lg" style={pal.text}>
          <Trans>Blocked</Trans>
        </Text>
      </View>
    )
  } else if (AppBskyEmbedRecord.isViewNotFound(embed.record)) {
    return (
      <View
        style={[styles.errorContainer, a.border, t.atoms.border_contrast_low]}>
        <InfoCircleIcon size={18} style={pal.text} />
        <Text type="lg" style={pal.text}>
          <Trans>Deleted</Trans>
        </Text>
      </View>
    )
  } else if (AppBskyEmbedRecord.isViewDetached(embed.record)) {
    const isViewerOwner = currentAccount?.did
      ? embed.record.uri.includes(currentAccount.did)
      : false
    return (
      <View
        style={[styles.errorContainer, a.border, t.atoms.border_contrast_low]}>
        <InfoCircleIcon size={18} style={pal.text} />
        <Text type="lg" style={pal.text}>
          {isViewerOwner ? (
            <Trans>Removed by you</Trans>
          ) : (
            <Trans>Removed by author</Trans>
          )}
        </Text>
      </View>
    )
  }
  return null
}

function EmbeddedPostModerated({
  viewRecord,
  onOpen,
  style,
  allowNestedQuotes,
  viewContext,
}: {
  viewRecord: AppBskyEmbedRecord.ViewRecord
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  allowNestedQuotes?: boolean
  viewContext?: QuoteEmbedViewContext
}) {
  const moderationOpts = useModerationOpts()
  const postView = React.useMemo(
    () => viewRecordToPostView(viewRecord),
    [viewRecord],
  )
  const moderation = React.useMemo(() => {
    return moderationOpts ? moderatePost(postView, moderationOpts) : undefined
  }, [postView, moderationOpts])

  return (
    <EmbeddedPost
      post={postView}
      moderation={moderation}
      onOpen={onOpen}
      style={style}
      allowNestedQuotes={allowNestedQuotes}
      viewContext={viewContext}
    />
  )
}

export function EmbeddedPost({
  post,
  moderation,
  onOpen,
  style,
  allowNestedQuotes,
  showAuthor = true,
}: {
  post: AppBskyFeedDefs.PostView
  moderation?: ModerationDecision
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  allowNestedQuotes?: boolean
  viewContext?: QuoteEmbedViewContext
  showAuthor?: boolean
}) {
  const t = useTheme()
  const queryClient = useQueryClient()
  const pal = usePalette('default')
  const itemUrip = new AtUri(post.uri)

  const richText = React.useMemo(() => {
    const text = AppBskyFeedPost.isRecord(post.record) ? post.record.text : ''
    const facets = AppBskyFeedPost.isRecord(post.record)
      ? post.record.facets
      : undefined
    return text.trim()
      ? new RichTextAPI({text: text, facets: facets})
      : undefined
  }, [post.record])

  const embed = React.useMemo(() => {
    const e = post.embed

    if (allowNestedQuotes) {
      return e
    } else {
      if (
        AppBskyEmbedImages.isView(e) ||
        AppBskyEmbedExternal.isView(e) ||
        AppBskyEmbedVideo.isView(e)
      ) {
        return e
      } else if (
        AppBskyEmbedRecordWithMedia.isView(e) &&
        (AppBskyEmbedImages.isView(e.media) ||
          AppBskyEmbedExternal.isView(e.media) ||
          AppBskyEmbedVideo.isView(e.media))
      ) {
        return e.media
      }
    }
  }, [post.embed, allowNestedQuotes])

  const onBeforePress = React.useCallback(() => {
    precacheProfile(queryClient, post.author)
    onOpen?.()
  }, [queryClient, post.author, onOpen])

  const [hover, setHover] = React.useState(false)
  return (
    <View
      onPointerEnter={() => {
        setHover(true)
      }}
      onPointerLeave={() => {
        setHover(false)
      }}>
      <ContentHider
        modui={moderation?.ui('contentList')}
        style={[
          a.rounded_md,
          a.p_md,
          a.mt_sm,
          a.border,
          t.atoms.border_contrast_low,
          style,
        ]}
        childContainerStyle={[a.pt_sm]}>
        <SubtleWebHover hover={hover} />
        {showAuthor ? (
          <>
            {(() => {
              const itemHref = makeProfileLink(
                post.author,
                'post',
                itemUrip.rkey,
              )
              const itemTitle = `Post by ${post.author.handle}`

              return (
                <Link
                  hoverStyle={{borderColor: pal.colors.borderLinkHover}}
                  href={itemHref}
                  title={itemTitle}
                  onBeforePress={onBeforePress}>
                  <View pointerEvents="none">
                    <PostMeta
                      author={post.author}
                      moderation={moderation}
                      showAvatar
                      postHref={itemHref}
                      timestamp={post.indexedAt}
                      isPrivate={
                        post.$type ===
                        'social.spkeasy.feed.defs#privatePostView'
                      }
                    />
                  </View>
                  {moderation ? (
                    <PostAlerts
                      modui={moderation.ui('contentView')}
                      style={[a.py_xs]}
                    />
                  ) : null}
                  {richText ? (
                    <RichText
                      value={richText}
                      style={a.text_md}
                      numberOfLines={20}
                      disableLinks
                    />
                  ) : null}
                  {embed && (
                    <PostEmbeds embed={embed} moderation={moderation} />
                  )}
                </Link>
              )
            })()}
          </>
        ) : (
          <>
            {moderation ? (
              <PostAlerts
                modui={moderation.ui('contentView')}
                style={[a.py_xs]}
              />
            ) : null}
            {richText ? (
              <RichText
                value={richText}
                style={a.text_md}
                numberOfLines={20}
                disableLinks
              />
            ) : null}
            {embed && <PostEmbeds embed={embed} moderation={moderation} />}
          </>
        )}
      </ContentHider>
    </View>
  )
}

export function EmbeddedPostX({onRemove}: {onRemove: () => void}) {
  const {_} = useLingui()
  return (
    <TouchableOpacity
      style={[
        a.absolute,
        a.p_xs,
        a.rounded_full,
        a.align_center,
        a.justify_center,
        {
          top: 16,
          right: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
        },
      ]}
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={_(msg`Remove quote`)}
      accessibilityHint={_(msg`Removes quoted post`)}
      onAccessibilityEscape={onRemove}
      hitSlop={HITSLOP_20}>
      <FontAwesomeIcon size={12} icon="xmark" style={s.white} />
    </TouchableOpacity>
  )
}

export function LazyEmbeddedPost({uri}: {uri: string}) {
  const {data} = useResolveLinkQuery(uri)
  const moderationOpts = useModerationOpts()
  if (!data || data.type !== 'record' || data.kind !== 'post') {
    return null
  }
  const moderation = moderationOpts
    ? moderatePost(data.view, moderationOpts)
    : undefined
  return <EmbeddedPost post={data.view} moderation={moderation} />
}

function viewRecordToPostView(
  viewRecord: AppBskyEmbedRecord.ViewRecord,
): AppBskyFeedDefs.PostView {
  const {value, embeds, ...rest} = viewRecord
  return {
    ...rest,
    $type: 'app.bsky.feed.defs#postView',
    record: value,
    embed: embeds?.[0],
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
  },
})
