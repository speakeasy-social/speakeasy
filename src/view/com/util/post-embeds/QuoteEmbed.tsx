import React from 'react'
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native'
import {
  AppBskyEmbedRecord,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  ModerationDecision,
} from '@atproto/api'
import {Trans} from '@lingui/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {InfoCircleIcon} from '#/lib/icons'
import {moderatePost_wrapped as moderatePost} from '#/lib/moderatePost_wrapped'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useResolveLinkQuery} from '#/state/queries/resolve-link'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '../text/Text'
import {EmbeddedPost, EmbeddedPostX} from './EmbeddedPost'
import {QuoteEmbedViewContext} from './types'

export function MaybeQuoteEmbed({
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
      <QuoteEmbedModerated
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

function QuoteEmbedModerated({
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
    <QuoteEmbed
      quote={postView}
      moderation={moderation}
      onOpen={onOpen}
      style={style}
      allowNestedQuotes={allowNestedQuotes}
      viewContext={viewContext}
    />
  )
}

export function QuoteEmbed({
  quote,
  moderation,
  onOpen,
  style,
  allowNestedQuotes,
}: {
  quote: AppBskyFeedDefs.PostView
  moderation?: ModerationDecision
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
  allowNestedQuotes?: boolean
  viewContext?: QuoteEmbedViewContext
}) {
  return (
    <EmbeddedPost
      post={quote}
      moderation={moderation}
      onOpen={onOpen}
      style={style}
      allowNestedQuotes={allowNestedQuotes}
    />
  )
}

export function QuoteX({onRemove}: {onRemove: () => void}) {
  return <EmbeddedPostX onRemove={onRemove} />
}

export function LazyQuoteEmbed({uri}: {uri: string}) {
  const {data} = useResolveLinkQuery(uri)
  const moderationOpts = useModerationOpts()
  if (!data || data.type !== 'record' || data.kind !== 'post') {
    return null
  }
  const moderation = moderationOpts
    ? moderatePost(data.view, moderationOpts)
    : undefined
  return <QuoteEmbed quote={data.view} moderation={moderation} />
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
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alert: {
    marginBottom: 6,
  },
})
