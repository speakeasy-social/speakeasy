import {useEffect, useMemo, useState} from 'react'
import {AppBskyActorDefs} from '@atproto/api'
import EventEmitter from 'eventemitter3'

import {batchedUpdates} from '#/lib/batchedUpdates'
import {castAsShadow, Shadow} from './types'
export type {Shadow} from './types'

export interface ProfileShadow {
  followingUri: string | undefined
  muted: boolean | undefined
  blockingUri: string | undefined
  trusted: boolean | undefined
}

const shadows: Map<string, Partial<ProfileShadow>> = new Map()
const emitter = new EventEmitter()

export function useProfileShadow<
  TProfileView extends AppBskyActorDefs.ProfileView,
>(profile: TProfileView): Shadow<TProfileView> {
  const [shadow, setShadow] = useState(() => shadows.get(profile.did))
  const [prevProfile, setPrevProfile] = useState(profile)
  if (profile !== prevProfile) {
    setPrevProfile(profile)
    setShadow(shadows.get(profile.did))
  }

  useEffect(() => {
    function onUpdate() {
      setShadow(shadows.get(profile.did))
    }
    emitter.addListener(profile.did, onUpdate)
    return () => {
      emitter.removeListener(profile.did, onUpdate)
    }
  }, [profile])

  return useMemo(() => {
    if (shadow) {
      return mergeShadow(profile, shadow)
    } else {
      return castAsShadow(profile)
    }
  }, [profile, shadow])
}

export function clearAllShadows() {
  shadows.clear()
}

export function updateProfileShadow(
  _queryClient: unknown,
  did: string,
  value: Partial<ProfileShadow>,
) {
  shadows.set(did, {...shadows.get(did), ...value})
  batchedUpdates(() => {
    emitter.emit(did, value)
  })
}

function mergeShadow<TProfileView extends AppBskyActorDefs.ProfileView>(
  profile: TProfileView,
  shadow: Partial<ProfileShadow>,
): Shadow<TProfileView> {
  return castAsShadow({
    ...profile,
    viewer: {
      ...(profile.viewer || {}),
      following:
        'followingUri' in shadow
          ? shadow.followingUri
          : profile.viewer?.following,
      muted: 'muted' in shadow ? shadow.muted : profile.viewer?.muted,
      blocking:
        'blockingUri' in shadow ? shadow.blockingUri : profile.viewer?.blocking,
    },
  })
}
