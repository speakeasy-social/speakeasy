import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedPost,
  AppBskyFeedPostgate,
  AppBskyFeedThreadgate,
  AppBskyRichtextFacet,
  AtUri,
  BlobRef,
  BskyAgent,
  ComAtprotoLabelDefs,
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoStrongRef,
  ComAtprotoRepoUploadBlob,
  RichText,
} from '@atproto/api'
import {TID} from '@atproto/common-web'
import * as dcbor from '@ipld/dag-cbor'
import {t} from '@lingui/macro'
import {QueryClient} from '@tanstack/react-query'
import {sha256} from 'js-sha256'
import {CID} from 'multiformats/cid'
import * as Hasher from 'multiformats/hashes/hasher'

import {encryptContent} from '#/lib/encryption'
import {isNetworkError} from '#/lib/strings/errors'
import {shortenLinks, stripInvalidMentions} from '#/lib/strings/rich-text-manip'
import {logger} from '#/logger'
import {compressImage} from '#/state/gallery'
import {
  fetchResolveGifQuery,
  fetchResolveLinkQuery,
} from '#/state/queries/resolve-link'
import {
  createThreadgateRecord,
  threadgateAllowUISettingToAllowRecordValue,
} from '#/state/queries/threadgate'
import {
  EmbedDraft,
  PostDraft,
  ThreadDraft,
} from '#/view/com/composer/state/composer'
import {createGIFDescription} from '../gif-alt-text'
import {fetchEncryptedPosts} from './feed/private-posts'
import {uploadMediaToSpeakeasy} from './speakeasy'
import {uploadBlob} from './upload-blob'

export {uploadBlob}

interface PostOpts {
  thread: ThreadDraft
  replyTo?: string
  onStateChange?: (state: string) => void
  langs?: string[]
  collection: 'app.bsky.feed.post' | 'social.spkeasy.feed.privatePost'
  sessionKey?: string
  sessionId?: string
}

export async function preparePost(
  agent: BskyAgent,
  queryClient: QueryClient,
  opts: PostOpts,
): Promise<{
  writes: ComAtprotoRepoApplyWrites.Create[]
  uris: string[]
  cids: string[]
}> {
  const thread = opts.thread
  const cids = []
  opts.onStateChange?.(t`Processing...`)

  let replyPromise:
    | Promise<AppBskyFeedPost.Record['reply']>
    | AppBskyFeedPost.Record['reply']
    | undefined
  if (opts.replyTo) {
    // Not awaited to avoid waterfalls.
    replyPromise = resolveReply(agent, opts.replyTo)
  }

  // add top 3 languages from user preferences if langs is provided
  let langs = opts.langs
  if (opts.langs) {
    langs = opts.langs.slice(0, 3)
  }

  const did = agent.assertDid
  const writes: ComAtprotoRepoApplyWrites.Create[] = []
  const uris: string[] = []

  let now = new Date()
  let tid: TID | undefined

  for (let i = 0; i < thread.posts.length; i++) {
    const draft = thread.posts[i]

    // Not awaited to avoid waterfalls.
    const rtPromise = resolveRT(agent, draft.richtext)
    let rtPromisePublic
    if (draft.audience === 'hidden') {
      rtPromisePublic = resolveRT(
        agent,
        createDefaultHiddenMessage(draft.publicMessage),
      )
    }
    const embedPromise = resolveEmbed(
      agent,
      queryClient,
      draft,
      opts.onStateChange,
      opts.sessionKey,
      opts.sessionId,
    )
    let labels: ComAtprotoLabelDefs.SelfLabels | undefined
    if (draft.labels.length) {
      labels = {
        $type: 'com.atproto.label.defs#selfLabels',
        values: draft.labels.map(val => ({val})),
      }
    }

    // The sorting behavior for multiple posts sharing the same createdAt time is
    // undefined, so what we'll do here is increment the time by 1 for every post
    now.setMilliseconds(now.getMilliseconds() + 1)
    tid = TID.next(tid)
    const rkey = tid.toString()
    const uri = `at://${did}/${opts.collection}/${rkey}`
    uris.push(uri)

    const rt = await rtPromise
    const embed = await embedPromise
    const reply = await replyPromise
    const rtPublic = await rtPromisePublic

    // For hidden posts, encode the content in the embed and use public message as text
    let finalText = rt.text
    let finalEmbed = embed
    let finalFacets = rt.facets
    if (draft.audience === 'hidden' && rtPublic) {
      const hiddenContent = {
        realTalk: draft.realTalk,
        text: rt.text,
        facets: rt.facets,
        embed: embed,
      }
      finalText = rtPublic.text
      finalFacets = rtPublic.facets
      finalEmbed = {
        $type: 'social.spkeasy.embed.privateMessage',
        privateMessage: {
          encodedMessage: btoa(JSON.stringify(hiddenContent)),
        },
      }
    }

    const record: AppBskyFeedPost.Record = {
      $type: opts.collection,
      createdAt: now.toISOString(),
      text: finalText,
      facets: finalFacets,
      reply,
      embed: finalEmbed,
      langs,
      labels,
    }
    writes.push({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: opts.collection,
      rkey: rkey,
      value: record,
    })

    if (i === 0 && thread.threadgate.some(tg => tg.type !== 'everybody')) {
      writes.push({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.feed.threadgate',
        rkey: rkey,
        value: createThreadgateRecord({
          createdAt: now.toISOString(),
          post: uri,
          allow: threadgateAllowUISettingToAllowRecordValue(thread.threadgate),
        }),
      })
    }

    if (
      thread.postgate.embeddingRules?.length ||
      thread.postgate.detachedEmbeddingUris?.length
    ) {
      writes.push({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.feed.postgate',
        rkey: rkey,
        value: {
          ...thread.postgate,
          $type: 'app.bsky.feed.postgate',
          createdAt: now.toISOString(),
          post: uri,
        },
      })
    }

    const cid = await computeCid(record)
    cids.push(cid)

    // Prepare a ref to the current post for the next post in the thread.
    const ref = {
      cid,
      uri,
    }
    replyPromise = {
      root: reply?.root ?? ref,
      parent: ref,
    }
  }

  return {writes, uris, cids}
}

export async function post(
  agent: BskyAgent,
  queryClient: QueryClient,
  opts: PostOpts,
) {
  const {writes, uris} = await preparePost(agent, queryClient, opts)

  try {
    await agent.com.atproto.repo.applyWrites({
      repo: agent.assertDid,
      writes: writes,
      validate: true,
    })
  } catch (e: any) {
    logger.error(`Failed to create post`, {
      safeMessage: e.message,
    })
    if (isNetworkError(e)) {
      throw new Error(
        t`Post failed to upload. Please check your Internet connection and try again.`,
      )
    } else {
      throw e
    }
  }

  return {uris}
}

async function resolveRT(agent: BskyAgent, richtext: RichText) {
  let rt = new RichText({text: richtext.text.trimEnd()}, {cleanNewlines: true})
  await rt.detectFacets(agent)

  rt = shortenLinks(rt)
  rt = stripInvalidMentions(rt)
  return rt
}

async function resolveReply(
  agent: BskyAgent,
  replyTo: string,
): Promise<
  | {
      root: {uri: string; cid: string}
      parent: {uri: string; cid: string}
    }
  | undefined
> {
  // Resolve Speakeasy private posts
  if (replyTo.includes('/social.spkeasy.feed.privatePost/')) {
    const encryptedPosts = await fetchEncryptedPosts(agent, {
      uris: [replyTo],
    })
    if (encryptedPosts.encryptedPosts.length === 0) {
      throw new Error(t`Post not found`)
    }
    const encryptedPost = encryptedPosts.encryptedPosts[0]
    return {
      root: {
        uri: encryptedPost.uri,
        cid: 'fixme-calculate-cid',
      },
      parent: {
        uri: encryptedPost.reply?.root.uri || encryptedPost.uri,
        cid: 'fixme-calculate-cid',
      },
    }
  }
  const replyToUrip = new AtUri(replyTo)
  const parentPost = await agent.getPost({
    repo: replyToUrip.host,
    rkey: replyToUrip.rkey,
  })
  if (parentPost) {
    const parentRef = {
      uri: parentPost.uri,
      cid: parentPost.cid,
    }
    return {
      root: parentPost.value.reply?.root || parentRef,
      parent: parentRef,
    }
  }
}

async function resolveEmbed(
  agent: BskyAgent,
  queryClient: QueryClient,
  draft: PostDraft,
  onStateChange: ((state: string) => void) | undefined,
  sessionKey?: string,
  sessionId?: string,
): Promise<
  | AppBskyEmbedImages.Main
  | AppBskyEmbedVideo.Main
  | AppBskyEmbedExternal.Main
  | AppBskyEmbedRecord.Main
  | AppBskyEmbedRecordWithMedia.Main
  | {
      $type: 'social.spkeasy.embed.privateMessage'
      privateMessage: {encodedMessage: string}
    }
  | undefined
> {
  if (draft.embed.quote) {
    const [resolvedMedia, resolvedQuote] = await Promise.all([
      resolveMedia(
        agent,
        queryClient,
        draft.embed,
        onStateChange,
        draft.audience,
        sessionKey,
        sessionId,
      ),
      resolveRecord(agent, queryClient, draft.embed.quote.uri),
    ])
    if (resolvedMedia) {
      return {
        $type: 'app.bsky.embed.recordWithMedia',
        record: {
          $type: 'app.bsky.embed.record',
          record: resolvedQuote,
        },
        media: resolvedMedia,
      }
    }
    return {
      $type: 'app.bsky.embed.record',
      record: resolvedQuote,
    }
  }
  const resolvedMedia = await resolveMedia(
    agent,
    queryClient,
    draft.embed,
    onStateChange,
    draft.audience,
    sessionKey,
    sessionId,
  )
  if (resolvedMedia) {
    return resolvedMedia
  }
  if (draft.embed.link) {
    const resolvedLink = await fetchResolveLinkQuery(
      queryClient,
      agent,
      draft.embed.link.uri,
    )
    if (resolvedLink.type === 'record') {
      return {
        $type: 'app.bsky.embed.record',
        record: resolvedLink.record,
      }
    }
    if (resolvedLink.type === 'external') {
      let blob: BlobRef | undefined
      if (resolvedLink.thumb) {
        onStateChange?.(t`Uploading link thumbnail...`)
        const {path, mime} = resolvedLink.thumb.source
        let response
        if (draft.audience === 'trusted' || draft.audience === 'hidden') {
          if (!sessionKey || !sessionId) {
            throw new Error(
              'Session key and session ID must be provided for speakeasy uploads',
            )
          }
          response = await uploadBlobToSpeakeasy(
            agent,
            path,
            mime,
            sessionId,
            sessionKey,
          )
        } else {
          response = await uploadBlob(agent, path, mime)
        }
        blob = response.data.blob
      }
      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: resolvedLink.uri,
          title: resolvedLink.title,
          description: resolvedLink.description,
          thumb: blob,
        },
      }
    }
  }
  return undefined
}

async function resolveMedia(
  agent: BskyAgent,
  queryClient: QueryClient,
  embedDraft: EmbedDraft,
  onStateChange: ((state: string) => void) | undefined,
  audience?: string,
  sessionKey?: string,
  sessionId?: string,
): Promise<
  | AppBskyEmbedExternal.Main
  | AppBskyEmbedImages.Main
  | AppBskyEmbedVideo.Main
  | undefined
> {
  if (embedDraft.media?.type === 'images') {
    const imagesDraft = embedDraft.media.images
    logger.debug(`Uploading images`, {
      count: imagesDraft.length,
    })
    onStateChange?.(t`Uploading images...`)
    const images: AppBskyEmbedImages.Image[] = await Promise.all(
      imagesDraft.map(async (image, i) => {
        logger.debug(`Compressing image #${i}`)
        const {path, width, height, mime} = await compressImage(image)
        logger.debug(`Uploading image #${i}`)

        // Use speakeasy upload for trusted/hidden audiences
        let uploadResult
        if (audience === 'trusted' || audience === 'hidden') {
          if (!sessionKey || !sessionId) {
            throw new Error(
              'Session key and session ID must be provided for speakeasy uploads',
            )
          }
          uploadResult = await uploadBlobToSpeakeasy(
            agent,
            path,
            mime,
            sessionId,
            sessionKey,
          )
        } else {
          uploadResult = await uploadBlob(agent, path, mime)
        }

        return {
          image: uploadResult.data.blob,
          alt: image.alt,
          aspectRatio: {width, height},
        }
      }),
    )
    return {
      $type: 'app.bsky.embed.images',
      images,
    }
  }
  if (
    embedDraft.media?.type === 'video' &&
    embedDraft.media.video.status === 'done'
  ) {
    const videoDraft = embedDraft.media.video
    const captions = await Promise.all(
      videoDraft.captions
        .filter(caption => caption.lang !== '')
        .map(async caption => {
          const {data} = await agent.uploadBlob(caption.file, {
            encoding: 'text/vtt',
          })
          return {lang: caption.lang, file: data.blob}
        }),
    )
    return {
      $type: 'app.bsky.embed.video',
      video: videoDraft.pendingPublish.blobRef,
      alt: videoDraft.altText || undefined,
      captions: captions.length === 0 ? undefined : captions,
      aspectRatio: {
        width: videoDraft.asset.width,
        height: videoDraft.asset.height,
      },
    }
  }
  if (embedDraft.media?.type === 'gif') {
    const gifDraft = embedDraft.media
    const resolvedGif = await fetchResolveGifQuery(
      queryClient,
      agent,
      gifDraft.gif,
    )
    let blob: BlobRef | undefined
    if (resolvedGif.thumb) {
      onStateChange?.(t`Uploading link thumbnail...`)
      const {path, mime} = resolvedGif.thumb.source
      let response
      if (audience === 'trusted' || audience === 'hidden') {
        if (!sessionKey || !sessionId) {
          throw new Error(
            'Session key and session ID must be provided for speakeasy uploads',
          )
        }
        response = await uploadBlobToSpeakeasy(
          agent,
          path,
          mime,
          sessionId,
          sessionKey,
        )
      } else {
        response = await uploadBlob(agent, path, mime)
      }
      blob = response.data.blob
    }
    return {
      $type: 'app.bsky.embed.external',
      external: {
        uri: resolvedGif.uri,
        title: resolvedGif.title,
        description: createGIFDescription(resolvedGif.title, gifDraft.alt),
        thumb: blob,
      },
    }
  }
  return undefined
}

async function resolveRecord(
  agent: BskyAgent,
  queryClient: QueryClient,
  uri: string,
): Promise<ComAtprotoRepoStrongRef.Main> {
  const resolvedLink = await fetchResolveLinkQuery(queryClient, agent, uri)
  if (resolvedLink.type !== 'record') {
    throw Error(t`Expected uri to resolve to a record`)
  }
  return resolvedLink.record
}

// The built-in hashing functions from multiformats (`multiformats/hashes/sha2`)
// are meant for Node.js, this is the cross-platform equivalent.
const mf_sha256 = Hasher.from({
  name: 'sha2-256',
  code: 0x12,
  encode: input => {
    const digest = sha256.arrayBuffer(input)
    return new Uint8Array(digest)
  },
})

async function computeCid(record: AppBskyFeedPost.Record): Promise<string> {
  // IMPORTANT: `prepareObject` prepares the record to be hashed by removing
  // fields with undefined value, and converting BlobRef instances to the
  // right IPLD representation.
  const prepared = prepareForHashing(record)
  // 1. Encode the record into DAG-CBOR format
  const encoded = dcbor.encode(prepared)
  // 2. Hash the record in SHA-256 (code 0x12)
  const digest = await mf_sha256.digest(encoded)
  // 3. Create a CIDv1, specifying DAG-CBOR as content (code 0x71)
  const cid = CID.createV1(0x71, digest)
  // 4. Get the Base32 representation of the CID (`b` prefix)
  return cid.toString()
}

// Returns a transformed version of the object for use in DAG-CBOR.
function prepareForHashing(v: any): any {
  // IMPORTANT: BlobRef#ipld() returns the correct object we need for hashing,
  // the API client will convert this for you but we're hashing in the client,
  // so we need it *now*.
  if (v instanceof BlobRef) {
    return v.ipld()
  }

  // Walk through arrays
  if (Array.isArray(v)) {
    let pure = true
    const mapped = v.map(value => {
      if (value !== (value = prepareForHashing(value))) {
        pure = false
      }
      return value
    })
    return pure ? v : mapped
  }

  // Walk through plain objects
  if (isPlainObject(v)) {
    const obj: any = {}
    let pure = true
    for (const key in v) {
      let value = v[key]
      // `value` is undefined
      if (value === undefined) {
        pure = false
        continue
      }
      // `prepareObject` returned a value that's different from what we had before
      if (value !== (value = prepareForHashing(value))) {
        pure = false
      }
      obj[key] = value
    }
    // Return as is if we haven't needed to tamper with anything
    return pure ? v : obj
  }
  return v
}

function isPlainObject(v: any): boolean {
  if (typeof v !== 'object' || v === null) {
    return false
  }
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

export function createDefaultHiddenMessage(
  richtext: RichText | undefined,
): RichText {
  return (
    richtext ||
    new RichText({
      text: 'This is a hidden post and can only be seen on @spkeasy.social',
      facets: [
        {
          index: {byteStart: 46, byteEnd: 61},
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: 'did:plc:spkeasy.social',
            },
          ],
        },
      ],
    })
  )
}

export type CombinedPost = {
  uri: string
  cid: string
  media: {
    id: string
  }
  record: {
    reply?: AppBskyFeedPost.ReplyRef
    langs?: string[]
    facets?: AppBskyRichtextFacet.Main[]
    labels?: any
    text: string
    embed?:
      | AppBskyEmbedImages.View
      | AppBskyEmbedVideo.View
      | AppBskyEmbedExternal.View
      | AppBskyEmbedRecord.View
      | AppBskyEmbedRecordWithMedia.View
      | {$type: string; [k: string]: unknown}
    [k: string]: unknown
  }
  threadgate?: {
    uri: string
    cid: string
    record: AppBskyFeedThreadgate.Record
  }
  postgate?: {
    uri: string
    cid: string
    record: AppBskyFeedPostgate.Record
  }
}

export function combinePostGates(
  authorDid: string,
  writes: ComAtprotoRepoApplyWrites.Create[],
  uris: string[],
  cids: string[],
): CombinedPost[] {
  const formattedPosts: CombinedPost[] = []

  writes.forEach(write => {
    if (!write.rkey) return

    const uri = `at://${authorDid}/${write.collection}/${write.rkey}`

    if (write.collection === 'social.spkeasy.feed.privatePost' && write.value) {
      const postIndex = uris.indexOf(uri)
      const record = write.value as AppBskyFeedPost.Record
      const embed = record.embed as
        | {images?: Array<{image?: {mediaId?: string}}>}
        | undefined
      formattedPosts.push({
        uri,
        cid: cids[postIndex],
        media: {
          id: embed?.images?.[0]?.image?.mediaId!,
        },
        record: record as any,
      })
    } else if (write.collection === 'app.bsky.feed.threadgate' && write.value) {
      const lastPost = formattedPosts[formattedPosts.length - 1]
      if (lastPost) {
        lastPost.threadgate = {
          uri: `at://${authorDid}/app.bsky.feed.threadgate/${lastPost.uri
            .split('/')
            .pop()}`,
          cid: '', // This would need to be filled in from the actual response
          record: write.value as AppBskyFeedThreadgate.Record,
        }
      }
    } else if (write.collection === 'app.bsky.feed.postgate' && write.value) {
      const lastPost = formattedPosts[formattedPosts.length - 1]
      if (lastPost) {
        lastPost.postgate = {
          uri: `at://${authorDid}/app.bsky.feed.postgate/${lastPost.uri
            .split('/')
            .pop()}`,
          cid: '', // This would need to be filled in from the actual response
          record: write.value as AppBskyFeedPostgate.Record,
        }
      }
    }
  })

  return formattedPosts
}

export async function formatPrivatePosts(
  posts: CombinedPost[],
  sessionKey: string,
) {
  return Promise.all(
    posts.map(async formattedPost => {
      // Collect all media IDs from embeds
      const mediaIds: string[] = []
      if (formattedPost.record.embed) {
        type ImageEmbed = {
          $type: 'app.bsky.embed.images'
          images: Array<{image: {mediaId: string}}>
        }
        type RecordWithMediaEmbed = {
          $type: 'app.bsky.embed.recordWithMedia'
          media: {
            $type: 'app.bsky.embed.images'
            images: Array<{image: {mediaId: string}}>
          }
        }
        const embed = formattedPost.record.embed as
          | ImageEmbed
          | RecordWithMediaEmbed

        if (embed.$type === 'app.bsky.embed.images') {
          embed.images.forEach(img => {
            if (img.image.mediaId) {
              mediaIds.push(img.image.mediaId)
            }
          })
        } else if (
          embed.$type === 'app.bsky.embed.recordWithMedia' &&
          embed.media.$type === 'app.bsky.embed.images'
        ) {
          embed.media.images.forEach(img => {
            if (img.image.mediaId) {
              mediaIds.push(img.image.mediaId)
            }
          })
        }
      }

      const contentToEncrypt = {
        ...formattedPost.record,
        postgate: formattedPost.postgate,
        threadgate: formattedPost.threadgate,
      }
      const encryptedContent = await encryptContent(
        JSON.stringify(contentToEncrypt),
        sessionKey,
      )
      return {
        rkey: formattedPost.uri.split('/').pop(),
        reply: formattedPost.record.reply
          ? {
              root: formattedPost.record.reply.root,
              parent: formattedPost.record.reply.parent,
            }
          : undefined,
        uri: formattedPost.uri,
        langs: formattedPost.record.langs,
        encryptedContent: encryptedContent,
        media: mediaIds,
      }
    }),
  )
}

/**
 * Upload a blob to the Speakeasy media service
 * @param agent - The BskyAgent instance
 * @param path - Path to the file to upload
 * @param mime - MIME type of the file
 * @returns Promise with the upload response
 */
async function uploadBlobToSpeakeasy(
  agent: BskyAgent,
  path: string,
  mime: string,
  sessionId: string,
  sessionKey: string,
): Promise<ComAtprotoRepoUploadBlob.Response> {
  try {
    if (!sessionKey || !sessionId) {
      throw new Error(
        'Session key and session ID must be provided for speakeasy uploads',
      )
    }

    // First convert to a blob just like the standard uploadBlob does
    let blob: Blob

    if (typeof path === 'string' && path.startsWith('file:')) {
      // Use XMLHttpRequest for file:// URIs (especially for Android)
      blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onload = () => resolve(xhr.response)
        xhr.onerror = () => reject(new Error('Failed to load blob'))
        xhr.responseType = 'blob'
        xhr.open('GET', path, true)
        xhr.send(null)
      })
    } else if (typeof path === 'string' && path.startsWith('/')) {
      // Absolute path - convert to file:// URL
      blob = await fetch(`file://${path}`).then(r => r.blob())
    } else if (typeof path === 'string' && path.startsWith('data:')) {
      // Data URI
      blob = await fetch(path).then(r => r.blob())
    } else if (
      typeof path === 'string' &&
      (path.startsWith('http:') ||
        path.startsWith('https:') ||
        path.startsWith('blob:'))
    ) {
      // HTTP/HTTPS/Blob URL
      blob = await fetch(path).then(r => r.blob())
    } else {
      throw new TypeError(`Invalid uploadBlob input: ${typeof path}`)
    }

    // Benchmark encryption if session key is provided
    if (sessionKey === 'encryption not implemented yet') {
      console.log(
        new Date().toISOString(),
        '- Starting media encryption benchmark',
      )
      console.log(`Blob size: ${blob.size} bytes`)

      // Convert blob to Base64 string for encryption
      const arrayBuffer = await blob.arrayBuffer()
      const base64String = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      )

      // Encrypt the blob
      await encryptContent(base64String, sessionKey)
      console.log(
        new Date().toISOString(),
        '- Finished media encryption benchmark',
      )
    }

    // Use the dedicated Speakeasy upload function that handles URL and host resolution
    return await uploadMediaToSpeakeasy(agent, blob, mime, sessionId)
  } catch (e: any) {
    logger.error('Failed to upload blob to Speakeasy', {
      safeMessage: e.message,
    })
    throw e
  }
}
