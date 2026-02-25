import {AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {
  hasAccessToPrivateProfile,
  isPrivateProfile,
  type ProfileWithPrivateMeta,
} from '#/lib/api/private-profiles'
import {LockPill} from '#/view/com/util/PrivatePostPill'
import {useTheme} from '#/alf'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'

type Profile = AppBskyActorDefs.ProfileViewBasic & ProfileWithPrivateMeta

export function PrivateProfileIndicator({
  profile,
  preview = false,
}: {
  profile: Profile | null | undefined
  preview?: boolean
}) {
  const t = useTheme()
  const {_} = useLingui()

  if (!profile || !isPrivateProfile(profile)) {
    return null
  }

  const showPill = !preview && hasAccessToPrivateProfile(profile)

  if (showPill) {
    return (
      <LockPill
        label={_(msg`Private Profile`)}
        ariaLabel={_(msg`Private profile`)}
      />
    )
  }

  return (
    <LockIcon
      style={{color: t.atoms.text_contrast_medium.color}}
      width={12}
      height={12}
      title={_(msg`Private profile`)}
      aria-label={_(msg`Private profile`)}
    />
  )
}
