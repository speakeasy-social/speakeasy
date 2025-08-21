import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlassFilled} from '#/components/icons/MagnifyingGlass'
import {MagnifyingGlass2_Stroke2_Corner0_Rounded as MagnifyingGlass} from '#/components/icons/MagnifyingGlass2'
import {NAV_ICON_WIDTH} from '../constants'
import NavItem from '../NavItem'

const Search = () => {
  const {_} = useLingui()
  const pal = usePalette('default')

  return (
    <NavItem
      href="/search"
      icon={
        <MagnifyingGlass
          style={pal.text}
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
        />
      }
      iconFilled={
        <MagnifyingGlassFilled
          style={pal.text}
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
        />
      }
      label={_(msg`Search`)}
    />
  )
}

export default Search
