import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  BulletList_Filled_Corner0_Rounded as ListFilled,
  BulletList_Stroke2_Corner0_Rounded as List,
} from '#/components/icons/BulletList'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Lists = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/lists"
      icon={<List style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />}
      iconFilled={
        <ListFilled
          style={pal.text}
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
        />
      }
      label={_(msg`Lists`)}
    />
  )
}

export default Lists
