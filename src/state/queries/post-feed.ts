import React, {useCallback, useEffect, useRef} from 'react'
import {AppState} from 'react-native'
import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  AtUri,
  BskyAgent,
  ModerationDecision,
} from '@atproto/api'
import {
  InfiniteData,
  QueryClient,
  QueryKey,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {AuthorFeedAPI} from '#/lib/api/feed/author'
import {CustomFeedAPI} from '#/lib/api/feed/custom'
import {FollowingFeedAPI} from '#/lib/api/feed/following'
import {HomeFeedAPI} from '#/lib/api/feed/home'
import {LikesFeedAPI} from '#/lib/api/feed/likes'
import {ListFeedAPI} from '#/lib/api/feed/list'
import {MergeFeedAPI} from '#/lib/api/feed/merge'
import {PrivatePostsWrapper} from '#/lib/api/feed/private-posts-wrapper'
import {FeedAPI, ReasonFeedSource} from '#/lib/api/feed/types'
import {aggregateUserInterests, getBaseCdnUrl} from '#/lib/api/feed/utils'
import {FeedTuner, FeedTunerFn} from '#/lib/api/feed-manip'
import {isAnyPostView} from '#/lib/api/speakeasy'
import {DISCOVER_FEED_URI} from '#/lib/constants'
import {BSKY_FEED_OWNER_DIDS} from '#/lib/constants'
import {moderatePost_wrapped as moderatePost} from '#/lib/moderatePost_wrapped'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {DEFAULT_LOGGED_OUT_PREFERENCES} from '#/state/queries/preferences/const'
import {useAgent} from '#/state/session'
import * as userActionHistory from '#/state/userActionHistory'
import {KnownError} from '#/view/com/posts/PostFeedErrorMessage'
import {useFeedTuners} from '../preferences/feed-tuners'
import {useModerationOpts} from '../preferences/moderation-opts'
import {usePreferencesQuery} from './preferences'
import {
  didOrHandleUriMatches,
  embedViewRecordToPostView,
  getEmbeddedPost,
} from './util'

type ActorDid = string
export type AuthorFilter =
  | 'posts_with_replies'
  | 'posts_no_replies'
  | 'posts_and_author_threads'
  | 'posts_with_media'
type FeedUri = string
type ListUri = string

export type FeedDescriptor =
  | 'following'
  | 'friends-pics'
  | `author|${ActorDid}|${AuthorFilter}`
  | `feedgen|${FeedUri}`
  | `likes|${ActorDid}`
  | `list|${ListUri}`
export interface FeedParams {
  mergeFeedEnabled?: boolean
  mergeFeedSources?: string[]
  feedCacheKey?: 'discover' | 'explore' | undefined
}

type RQPageParam = {cursor: string | undefined; api: FeedAPI} | undefined

export const RQKEY_ROOT = 'post-feed'
export function RQKEY(feedDesc: FeedDescriptor, params?: FeedParams) {
  return [RQKEY_ROOT, feedDesc, params || {}]
}

export interface FeedPostSliceItem {
  _reactKey: string
  uri: string
  post: AppBskyFeedDefs.PostView
  record: AppBskyFeedPost.Record
  moderation: ModerationDecision
  parentAuthor?: AppBskyActorDefs.ProfileViewBasic
  isParentBlocked?: boolean
  isParentNotFound?: boolean
}

export interface FeedPostSlice {
  _isFeedPostSlice: boolean
  _reactKey: string
  items: FeedPostSliceItem[]
  isIncompleteThread: boolean
  isFallbackMarker: boolean
  feedContext: string | undefined
  reason?:
    | AppBskyFeedDefs.ReasonRepost
    | AppBskyFeedDefs.ReasonPin
    | ReasonFeedSource
    | {[k: string]: unknown; $type: string}
}

export interface FeedPageUnselected {
  api: FeedAPI
  cursor: string | undefined
  feed: AppBskyFeedDefs.FeedViewPost[]
  fetchedAt: number
}

export interface FeedPage {
  api: FeedAPI
  tuner: FeedTuner
  cursor: string | undefined
  slices: FeedPostSlice[]
  fetchedAt: number
}

/**
 * The minimum number of posts we want in a single "page" of results. Since we
 * filter out unwanted content, we may fetch more than this number to ensure
 * that we get _at least_ this number.
 */
const MIN_POSTS = 30

export function usePostFeedQuery(
  feedDesc: FeedDescriptor,
  params?: FeedParams,
  opts?: {enabled?: boolean; ignoreFilterFor?: string},
) {
  const feedTuners = useFeedTuners(feedDesc)
  const moderationOpts = useModerationOpts()
  const {data: preferences} = usePreferencesQuery()
  const enabled =
    opts?.enabled !== false && Boolean(moderationOpts) && Boolean(preferences)
  const userInterests = aggregateUserInterests(preferences)
  const followingPinnedIndex =
    preferences?.savedFeeds?.findIndex(
      f => f.pinned && f.value === 'following',
    ) ?? -1
  const enableFollowingToDiscoverFallback = followingPinnedIndex === 0
  const agent = useAgent()
  const lastRun = useRef<{
    data: InfiniteData<FeedPageUnselected>
    args: typeof selectArgs
    result: InfiniteData<FeedPage>
  } | null>(null)
  const isDiscover = feedDesc.includes(DISCOVER_FEED_URI)
  const baseUrl = getBaseCdnUrl(agent)

  /**
   * The number of posts to fetch in a single request. Because we filter
   * unwanted content, we may over-fetch here to try and fill pages by
   * `MIN_POSTS`. But if you're doing this, ask @why if it's ok first.
   */
  const fetchLimit = MIN_POSTS

  // Make sure this doesn't invalidate unless really needed.
  const selectArgs = React.useMemo(
    () => ({
      feedTuners,
      moderationOpts,
      ignoreFilterFor: opts?.ignoreFilterFor,
      isDiscover,
      baseUrl,
    }),
    [feedTuners, moderationOpts, opts?.ignoreFilterFor, isDiscover, baseUrl],
  )

  const query = useInfiniteQuery<
    FeedPageUnselected,
    Error,
    InfiniteData<FeedPage>,
    QueryKey,
    RQPageParam
  >({
    enabled,
    staleTime: STALE.INFINITY,
    queryKey: RQKEY(feedDesc, params),
    async queryFn({pageParam}: {pageParam: RQPageParam}) {
      logger.debug('usePostFeedQuery', {feedDesc, cursor: pageParam?.cursor})

      // Check if the feedDesc is 'friends-pics' and treat it like 'following'
      const effectiveFeedDesc =
        feedDesc === 'friends-pics' ? 'following' : feedDesc

      logger.debug('usePostFeedQuery', {
        effectiveFeedDesc,
        cursor: pageParam?.cursor,
      })
      const {api, cursor} = pageParam
        ? pageParam
        : {
            api: createApi({
              feedDesc: effectiveFeedDesc,
              feedParams: params || {},
              feedTuners,
              agent,
              // Not in the query key because they don't change:
              userInterests,
              // Not in the query key. Reacting to it switching isn't important:
              enableFollowingToDiscoverFallback,
            }),
            cursor: undefined,
          }

      try {
        const res = await api.fetch({cursor, limit: fetchLimit})

        /*
         * If this is a public view, we need to check if posts fail moderation.
         * If all fail, we throw an error. If only some fail, we continue and let
         * moderations happen later, which results in some posts being shown and
         * some not.
         */
        if (!agent.session) {
          assertSomePostsPassModeration(res.feed)
        }

        return {
          api,
          cursor: res.cursor,
          feed: res.feed,
          fetchedAt: Date.now(),
        }
      } catch (e) {
        const feedDescParts = feedDesc.split('|')
        const feedOwnerDid = new AtUri(feedDescParts[1]).hostname

        if (
          feedDescParts[0] === 'feedgen' &&
          BSKY_FEED_OWNER_DIDS.includes(feedOwnerDid)
        ) {
          logger.error(`Bluesky feed may be offline: ${feedOwnerDid}`, {
            feedDesc,
            jsError: e,
          })
        }

        throw e
      }
    },
    initialPageParam: undefined,
    getNextPageParam: lastPage =>
      lastPage.cursor
        ? {
            api: lastPage.api,
            cursor: lastPage.cursor,
          }
        : undefined,
    select: useCallback(
      (data: InfiniteData<FeedPageUnselected, RQPageParam>) => {
        // If the selection depends on some data, that data should
        // be included in the selectArgs object and read here.
        const {
          feedTuners: feedTunersInSelect,
          moderationOpts: moderationOptsInSelect,
          ignoreFilterFor,
          isDiscover: isDiscoverInSelect,
        } = selectArgs

        const tuner = new FeedTuner(feedTunersInSelect)

        // Keep track of the last run and whether we can reuse
        // some already selected pages from there.
        let reusedPages = []
        if (lastRun.current) {
          const {
            data: lastData,
            args: lastArgs,
            result: lastResult,
          } = lastRun.current
          let canReuse = true
          for (let key in selectArgs) {
            if (selectArgs.hasOwnProperty(key)) {
              if ((selectArgs as any)[key] !== (lastArgs as any)[key]) {
                // Can't do reuse anything if any input has changed.
                canReuse = false
                break
              }
            }
          }
          if (canReuse) {
            for (let i = 0; i < data.pages.length; i++) {
              if (data.pages[i] && lastData.pages[i] === data.pages[i]) {
                reusedPages.push(lastResult.pages[i])
                // Keep the tuner in sync so that the end result is deterministic.
                tuner.tune(lastData.pages[i].feed)
                continue
              }
              // Stop as soon as pages stop matching up.
              break
            }
          }
        }

        const result = {
          pageParams: data.pageParams,
          pages: [
            ...reusedPages,
            ...data.pages.slice(reusedPages.length).map(page => ({
              api: page.api,
              tuner,
              cursor: page.cursor,
              fetchedAt: page.fetchedAt,
              slices: tuner
                .tune(page.feed)
                .map(slice => {
                  const moderations = slice.items.map(item =>
                    moderatePost(item.post, moderationOptsInSelect!),
                  )

                  // apply moderation filter
                  for (let i = 0; i < slice.items.length; i++) {
                    const ignoreFilter =
                      slice.items[i].post.author.did === ignoreFilterFor
                    if (ignoreFilter) {
                      // remove mutes to avoid confused UIs
                      moderations[i].causes = moderations[i].causes.filter(
                        cause => cause.type !== 'muted',
                      )
                    }
                    if (
                      !ignoreFilter &&
                      moderations[i]?.ui('contentList').filter
                    ) {
                      return undefined
                    }
                  }

                  if (isDiscoverInSelect) {
                    userActionHistory.seen(
                      slice.items.map(item => ({
                        feedContext: slice.feedContext,
                        likeCount: item.post.likeCount ?? 0,
                        repostCount: item.post.repostCount ?? 0,
                        replyCount: item.post.replyCount ?? 0,
                        isFollowedBy: Boolean(
                          item.post.author.viewer?.followedBy,
                        ),
                        uri: item.post.uri,
                      })),
                    )
                  }

                  const feedPostSlice: FeedPostSlice = {
                    _reactKey: slice._reactKey,
                    _isFeedPostSlice: true,
                    isIncompleteThread: slice.isIncompleteThread,
                    isFallbackMarker: slice.isFallbackMarker,
                    feedContext: slice.feedContext,
                    reason: slice.reason,
                    items: slice.items.map((item, i) => {
                      const feedPostSliceItem: FeedPostSliceItem = {
                        _reactKey: `${slice._reactKey}-${i}-${item.post.uri}`,
                        uri: item.post.uri,
                        post: item.post,
                        record: item.record,
                        moderation: moderations[i],
                        parentAuthor: item.parentAuthor,
                        isParentBlocked: item.isParentBlocked,
                        isParentNotFound: item.isParentNotFound,
                      }

                      transformHiddenEmbed(
                        item.record,
                        item.post,
                        selectArgs.baseUrl,
                      )

                      return feedPostSliceItem
                    }),
                  }
                  return feedPostSlice
                })
                .filter(n => !!n),
            })),
          ],
        }
        // Save for memoization.
        lastRun.current = {data, result, args: selectArgs}
        return result
      },
      [selectArgs /* Don't change. Everything needs to go into selectArgs. */],
    ),
  })

  // The server may end up returning an empty page, a page with too few items,
  // or a page with items that end up getting filtered out. When we fetch pages,
  // we'll keep track of how many items we actually hope to see. If the server
  // doesn't return enough items, we're going to continue asking for more items.
  const lastItemCount = useRef(0)
  const wantedItemCount = useRef(0)
  const autoPaginationAttemptCount = useRef(0)
  useEffect(() => {
    const {data, isLoading, isRefetching, isFetchingNextPage, hasNextPage} =
      query
    // Count the items that we already have.
    let itemCount = 0
    for (const page of data?.pages || []) {
      for (const slice of page.slices) {
        itemCount += slice.items.length
      }
    }

    // If items got truncated, reset the state we're tracking below.
    if (itemCount !== lastItemCount.current) {
      if (itemCount < lastItemCount.current) {
        wantedItemCount.current = itemCount
      }
      lastItemCount.current = itemCount
    }

    // Now track how many items we really want, and fetch more if needed.
    if (isLoading || isRefetching) {
      // During the initial fetch, we want to get an entire page's worth of items.
      wantedItemCount.current = MIN_POSTS
    } else if (isFetchingNextPage) {
      if (itemCount > wantedItemCount.current) {
        // We have more items than wantedItemCount, so wantedItemCount must be out of date.
        // Some other code must have called fetchNextPage(), for example, from onEndReached.
        // Adjust the wantedItemCount to reflect that we want one more full page of items.
        wantedItemCount.current = itemCount + MIN_POSTS
      }
    } else if (hasNextPage) {
      // At this point we're not fetching anymore, so it's time to make a decision.
      // If we didn't receive enough items from the server, paginate again until we do.
      if (itemCount < wantedItemCount.current) {
        autoPaginationAttemptCount.current++
        if (autoPaginationAttemptCount.current < 50 /* failsafe */) {
          query.fetchNextPage()
        }
      } else {
        autoPaginationAttemptCount.current = 0
      }
    }
  }, [query])

  return query
}

export async function pollLatest(page: FeedPage | undefined) {
  if (!page) {
    return false
  }
  if (AppState.currentState !== 'active') {
    return
  }

  logger.debug('usePostFeedQuery: pollLatest')
  const post = await page.api.peekLatest()
  if (post) {
    const slices = page.tuner.tune([post], {
      dryRun: true,
    })
    if (slices[0]) {
      return true
    }
  }

  return false
}

function createApi({
  feedDesc,
  feedParams,
  feedTuners,
  userInterests,
  agent,
  enableFollowingToDiscoverFallback,
}: {
  feedDesc: FeedDescriptor
  feedParams: FeedParams
  feedTuners: FeedTunerFn[]
  userInterests?: string
  agent: BskyAgent
  enableFollowingToDiscoverFallback: boolean
}) {
  let api: FeedAPI

  const privatePostSettings = [
    {
      feedDesc: 'following',
      mergeMethod: 'followers',
    },
    {
      feedDesc: DISCOVER_FEED_URI,
      mergeMethod: 'trusted',
    },
    {
      feedDesc: '/app.bsky.feed.generator/with-friends',
      mergeMethod: 'follower-likes',
    },
  ]

  if (feedDesc === 'following') {
    if (feedParams.mergeFeedEnabled) {
      api = new MergeFeedAPI({
        agent,
        feedParams,
        feedTuners,
        userInterests,
      })
    } else {
      if (enableFollowingToDiscoverFallback) {
        api = new HomeFeedAPI({agent, userInterests})
      } else {
        api = new FollowingFeedAPI({agent})
      }
    }
  } else if (feedDesc.startsWith('author')) {
    const [_, actor, filter] = feedDesc.split('|')
    api = new AuthorFeedAPI({agent, feedParams: {actor, filter}})

    // Wrap author feeds with PrivatePostsWrapper to merge private posts
    api = new PrivatePostsWrapper({
      wrappedFeed: api,
      agent,
      mergeMethod: 'followers',
      author: actor,
    })
  } else if (feedDesc.startsWith('likes')) {
    const [_, actor] = feedDesc.split('|')
    api = new LikesFeedAPI({agent, feedParams: {actor}})
  } else if (feedDesc.startsWith('feedgen')) {
    const [_, feed] = feedDesc.split('|')
    api = new CustomFeedAPI({
      agent,
      feedParams: {feed},
      userInterests,
    })
  } else if (feedDesc.startsWith('list')) {
    const [_, list] = feedDesc.split('|')
    api = new ListFeedAPI({agent, feedParams: {list}})
  } else {
    // shouldnt happen
    api = new FollowingFeedAPI({agent})
  }

  const privatePostConfig = privatePostSettings.find(config =>
    feedDesc.includes(config.feedDesc),
  )

  // Wrap the API with private posts if enabled for this feed type
  if (privatePostConfig) {
    api = new PrivatePostsWrapper({
      wrappedFeed: api,
      agent,
      mergeMethod: privatePostConfig.mergeMethod,
    })
  }

  return api
}

export function* findAllPostsInQueryData(
  queryClient: QueryClient,
  uri: string,
): Generator<AppBskyFeedDefs.PostView, undefined> {
  const atUri = new AtUri(uri)

  const queryDatas = queryClient.getQueriesData<
    InfiniteData<FeedPageUnselected>
  >({
    queryKey: [RQKEY_ROOT],
  })
  for (const [_queryKey, queryData] of queryDatas) {
    if (!queryData?.pages) {
      continue
    }
    for (const page of queryData?.pages) {
      for (const item of page.feed) {
        if (didOrHandleUriMatches(atUri, item.post)) {
          yield item.post
        }

        const quotedPost = getEmbeddedPost(item.post.embed)
        if (quotedPost && didOrHandleUriMatches(atUri, quotedPost)) {
          yield embedViewRecordToPostView(quotedPost)
        }

        if (isAnyPostView(item.reply?.parent)) {
          if (didOrHandleUriMatches(atUri, item.reply.parent)) {
            yield item.reply.parent
          }

          const parentQuotedPost = getEmbeddedPost(item.reply.parent.embed)
          if (
            parentQuotedPost &&
            didOrHandleUriMatches(atUri, parentQuotedPost)
          ) {
            yield embedViewRecordToPostView(parentQuotedPost)
          }
        }

        if (AppBskyFeedDefs.isPostView(item.reply?.root)) {
          if (didOrHandleUriMatches(atUri, item.reply.root)) {
            yield item.reply.root
          }

          const rootQuotedPost = getEmbeddedPost(item.reply.root.embed)
          if (rootQuotedPost && didOrHandleUriMatches(atUri, rootQuotedPost)) {
            yield embedViewRecordToPostView(rootQuotedPost)
          }
        }
      }
    }
  }
}

export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<AppBskyActorDefs.ProfileView, undefined> {
  const queryDatas = queryClient.getQueriesData<
    InfiniteData<FeedPageUnselected>
  >({
    queryKey: [RQKEY_ROOT],
  })
  for (const [_queryKey, queryData] of queryDatas) {
    if (!queryData?.pages) {
      continue
    }
    for (const page of queryData?.pages) {
      for (const item of page.feed) {
        if (item.post.author.did === did) {
          yield item.post.author
        }
        const quotedPost = getEmbeddedPost(item.post.embed)
        if (quotedPost?.author.did === did) {
          yield quotedPost.author
        }
        if (
          AppBskyFeedDefs.isPostView(item.reply?.parent) &&
          item.reply?.parent?.author.did === did
        ) {
          yield item.reply.parent.author
        }
        if (
          AppBskyFeedDefs.isPostView(item.reply?.root) &&
          item.reply?.root?.author.did === did
        ) {
          yield item.reply.root.author
        }
      }
    }
  }
}

export function transformHiddenEmbed(
  record: AppBskyFeedPost.Record,
  post: AppBskyFeedDefs.PostView,
  baseUrl: string,
) {
  if (
    record.embed &&
    record.embed.$type === 'social.spkeasy.embed.privateMessage'
  ) {
    const privateMessage = record.embed.privateMessage as {
      encodedMessage: string
      publicMessage: string
    }
    try {
      const decodedContent = formatPrivatePostForFeed(
        JSON.parse(atob(privateMessage.encodedMessage)),
        post.author.did, // Pass the parent post's author DID
        baseUrl,
      )

      // Store the original record as coverRecord
      post.coverRecord = {...record}

      // Replace both the post's record and the passed record with the decoded content
      const decodedRecord = decodedContent.record as AppBskyFeedPost.Record
      post.record = decodedRecord
      record.text = decodedRecord.text
      record.facets = decodedRecord.facets
      record.embed = decodedRecord.embed
      record.createdAt = decodedRecord.createdAt
      record.langs = decodedRecord.langs
      record.reply = decodedRecord.reply

      // Update the post's other properties
      post.embed = decodedContent.embed
      post.likeCount = decodedContent.likeCount
      post.replyCount = decodedContent.replyCount
      post.repostCount = decodedContent.repostCount
      post.quoteCount = decodedContent.quoteCount
      post.indexedAt = decodedContent.indexedAt
      post.labels = decodedContent.labels
      post.viewer = decodedContent.viewer || {}
    } catch (e) {
      console.error('Failed to decode private message:', e)
    }
  }
}

function assertSomePostsPassModeration(feed: AppBskyFeedDefs.FeedViewPost[]) {
  // no posts in this feed
  if (feed.length === 0) return true

  // assume false
  let somePostsPassModeration = false

  for (const item of feed) {
    const moderation = moderatePost(item.post, {
      userDid: undefined,
      prefs: DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs,
    })

    if (!moderation.ui('contentList').filter) {
      // we have a sfw post
      somePostsPassModeration = true
    }
  }

  if (!somePostsPassModeration) {
    throw new Error(KnownError.FeedSignedInOnly)
  }
}

export function resetPostsFeedQueries(queryClient: QueryClient, timeout = 0) {
  setTimeout(() => {
    queryClient.resetQueries({
      predicate: query => query.queryKey[0] === RQKEY_ROOT,
    })
  }, timeout)
}

export function resetProfilePostsQueries(
  queryClient: QueryClient,
  did: string,
  timeout = 0,
) {
  setTimeout(() => {
    queryClient.resetQueries({
      predicate: query =>
        !!(
          query.queryKey[0] === RQKEY_ROOT &&
          (query.queryKey[1] as string)?.includes(did)
        ),
    })
  }, timeout)
}

export function isFeedPostSlice(v: any): v is FeedPostSlice {
  return (
    v && typeof v === 'object' && '_isFeedPostSlice' in v && v._isFeedPostSlice
  )
}

function transformImageEmbed(
  embed: any,
  authorDid: string,
  baseUrl: string,
): any {
  if (embed?.$type === 'app.bsky.embed.images' && embed.images?.length > 0) {
    return {
      ...embed,
      $type: 'app.bsky.embed.images#view',
      images: embed.images.map((img: any) => {
        const blobRef = img.image.ref.$link
        // Use the media key if available, otherwise fall back to the blob ref
        const mediaKey = img.image.key || blobRef
        return {
          thumb: `${baseUrl}/${mediaKey}`,
          fullsize: `${baseUrl}/${mediaKey}`,
          mimeType: img.image.mimeType,
          alt: img.alt || '',
          aspectRatio: img.aspectRatio,
        }
      }),
    }
  }
  return embed
}

function transformVideoEmbed(
  embed: any,
  _authorDid: string,
  _baseUrl: string,
): any {
  if (embed?.$type === 'app.bsky.embed.video' && embed.video) {
    return {
      ...embed,
      $type: 'app.bsky.embed.video#view',
      video: {
        ...embed.video,
        uri: embed.video.uri,
        mimeType: embed.video.mimeType,
      },
    }
  }
  return embed
}

function transformExternalEmbed(
  embed: any,
  authorDid: string,
  baseUrl: string,
): any {
  if (embed?.$type === 'app.bsky.embed.external' && embed.external) {
    return {
      ...embed,
      $type: 'app.bsky.embed.external#view',
      external: {
        ...embed.external,
        uri: embed.external.uri,
        title: embed.external.title,
        description: embed.external.description,
        thumb: embed.external.thumb
          ? `${baseUrl}/${
              embed.external.thumb.key || embed.external.thumb.ref.$link
            }`
          : undefined,
      },
    }
  }
  return embed
}

function transformRecordEmbed(embed: any): any {
  if (embed?.$type === 'app.bsky.embed.record') {
    return {
      ...embed,
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewRecord',
        ...embed.record,
      },
    }
  }
  return embed
}

function transformRecordWithMediaEmbed(
  embed: any,
  authorDid: string,
  baseUrl: string,
): any {
  if (embed?.$type === 'app.bsky.embed.recordWithMedia') {
    const transformedMedia =
      embed.media?.$type === 'app.bsky.embed.images'
        ? transformImageEmbed(embed.media, authorDid, baseUrl)
        : embed.media?.$type === 'app.bsky.embed.video'
        ? transformVideoEmbed(embed.media, authorDid, baseUrl)
        : embed.media

    return {
      ...embed,
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: transformRecordEmbed(embed.record),
      media: transformedMedia,
    }
  }
  return embed
}

export function transformPrivateEmbed(
  embed: any,
  authorDid: string,
  baseUrl: string,
  quotedPost?: any,
): any {
  // Transform any embeds into view format
  let transformedEmbed = embed
  if (transformedEmbed) {
    if (transformedEmbed.$type === 'app.bsky.embed.images') {
      transformedEmbed = transformImageEmbed(
        transformedEmbed,
        authorDid,
        baseUrl,
      )
    } else if (transformedEmbed.$type === 'app.bsky.embed.video') {
      transformedEmbed = transformVideoEmbed(
        transformedEmbed,
        authorDid,
        baseUrl,
      )
    } else if (transformedEmbed.$type === 'app.bsky.embed.external') {
      transformedEmbed = transformExternalEmbed(
        transformedEmbed,
        authorDid,
        baseUrl,
      )
    } else if (transformedEmbed.$type === 'app.bsky.embed.record') {
      // If we have a quoted post, use it to enhance the record embed
      if (quotedPost) {
        transformedEmbed = transformRecordEmbed(transformedEmbed)
        transformedEmbed.record = {
          ...transformedEmbed.record,
          value: quotedPost.record,
          author: quotedPost.author,
          labels: quotedPost.labels,
          indexedAt: quotedPost.indexedAt,
          embeds: quotedPost.embed ? [quotedPost.embed] : undefined,
        }
      }
    } else if (transformedEmbed.$type === 'app.bsky.embed.recordWithMedia') {
      transformedEmbed = transformRecordWithMediaEmbed(
        transformedEmbed,
        authorDid,
        baseUrl,
      )
      // If we have a quoted post, use it to enhance the record embed
      if (quotedPost) {
        transformedEmbed.record.record = {
          ...transformedEmbed.record.record,
          value: quotedPost.record,
          author: quotedPost.author,
          labels: quotedPost.labels,
          indexedAt: quotedPost.indexedAt,
          embeds: quotedPost.embed ? [quotedPost.embed] : undefined,
        }
      }
    }
  }
  return transformedEmbed
}

export function formatPrivatePostForFeed(
  post: any,
  authorDid: string,
  baseUrl: string,
): AppBskyFeedDefs.PostView {
  try {
    const text = post.record?.text || post.text || ''
    const facets = post.record?.facets || post.facets || []
    const transformedEmbed = transformPrivateEmbed(
      post.embed,
      authorDid,
      baseUrl,
    )

    // Also transform any embeds in the record
    if (post.record?.embed) {
      post.record.embed = transformPrivateEmbed(
        post.record.embed,
        authorDid,
        baseUrl,
      )
    }

    // Construct a minimal PostView with just text
    const postView: AppBskyFeedDefs.PostView = {
      uri: post.uri || `at://${authorDid}/app.bsky.feed.post/${post.rkey}`,
      cid: post.cid || 'unknown',
      author: post.author || {
        did: authorDid,
        handle: 'unknown',
        viewer: {muted: false, blockedBy: false},
        labels: [],
      },
      record: {
        text,
        $type: 'app.bsky.feed.post',
        createdAt: post.record?.createdAt || new Date().toISOString(),
        ...(post.record?.embed ? {embed: post.record.embed} : {}),
        ...(facets.length > 0 ? {facets} : {}),
      } as AppBskyFeedPost.Record,
      embed: transformedEmbed,
      indexedAt: post.indexedAt || new Date().toISOString(),
      $type: 'app.bsky.feed.defs#postView',
      labels: [],
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
    }

    return postView
  } catch (e) {
    console.error('Failed to decode private message:', e)
    throw e
  }
}

export function useGetPost() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  return useCallback(
    async ({uri}: {uri: string}) => {
      return queryClient.fetchQuery({
        queryKey: ['post', uri],
        async queryFn() {
          const urip = new AtUri(uri)

          if (!urip.host.startsWith('did:')) {
            const res = await agent.resolveHandle({
              handle: urip.host,
            })
            urip.host = res.data.did
          }

          const res = await agent.getPosts({
            uris: [urip.toString()],
          })

          if (res.success && res.data.posts[0]) {
            return res.data.posts[0]
          }

          throw new Error('useGetPost: post not found')
        },
      })
    },
    [queryClient, agent],
  )
}
