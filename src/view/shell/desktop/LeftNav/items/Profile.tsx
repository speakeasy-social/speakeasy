import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {makeProfileLink} from '#/lib/routes/links'
import {useSession} from '#/state/session'
import {
  UserCircle_Filled_Corner0_Rounded as UserCircleFilled,
  UserCircle_Stroke2_Corner0_Rounded as UserCircle,
} from '#/components/icons/UserCircle'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Profile = () => {
  const {_} = useLingui()
  const pal = usePalette('default')
  const {currentAccount} = useSession()

  return (
    <NavItem
      href={currentAccount ? makeProfileLink(currentAccount) : '/'}
      icon={
        <UserCircle
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      iconFilled={
        <UserCircleFilled
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
          style={pal.text}
        />
      }
      label={_(msg`Profile`)}
    />
  )
}

export default Profile
