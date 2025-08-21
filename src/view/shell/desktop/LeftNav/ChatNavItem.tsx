import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePalette} from '#/lib/hooks/usePalette'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {
  Message_Stroke2_Corner0_Rounded as Message,
  Message_Stroke2_Corner0_Rounded_Filled as MessageFilled,
} from '#/components/icons/Message'
import {NAV_ICON_WIDTH} from './constants'
import NavItem from './NavItem'

function ChatNavItem() {
  const pal = usePalette('default')
  const {_} = useLingui()
  const numUnreadMessages = useUnreadMessageCount()

  return (
    <NavItem
      href="/messages"
      count={numUnreadMessages.numUnread}
      icon={
        <Message style={pal.text} aria-hidden={true} width={NAV_ICON_WIDTH} />
      }
      iconFilled={
        <MessageFilled
          style={pal.text}
          aria-hidden={true}
          width={NAV_ICON_WIDTH}
        />
      }
      label={_(msg`Chat`)}
    />
  )
}

export default ChatNavItem
