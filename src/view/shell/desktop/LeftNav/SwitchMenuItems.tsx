import {View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useAccountSwitcher} from '#/lib/hooks/useAccountSwitcher'
import {sanitizeHandle} from '#/lib/strings/handles'
import {SessionAccount} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {tokens} from '#/alf'
import {DialogControlProps} from '#/components/Dialog'
import {ArrowBoxLeft_Stroke2_Corner0_Rounded as LeaveIcon} from '#/components/icons/ArrowBoxLeft'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Menu from '#/components/Menu'

function SwitchMenuItems({
  accounts,
  signOutPromptControl,
}: {
  accounts:
    | {
        account: SessionAccount
        profile?: AppBskyActorDefs.ProfileView
      }[]
    | undefined
  signOutPromptControl: DialogControlProps
}) {
  const {_} = useLingui()
  const {onPressSwitchAccount, pendingDid} = useAccountSwitcher()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const closeEverything = useCloseAllActiveElements()

  const onAddAnotherAccount = () => {
    setShowLoggedOut(true)
    closeEverything()
  }
  return (
    <Menu.Outer>
      {accounts && accounts.length > 0 && (
        <>
          <Menu.Group>
            <Menu.LabelText>
              <Trans>Switch account</Trans>
            </Menu.LabelText>
            {accounts.map(other => (
              <Menu.Item
                disabled={!!pendingDid}
                style={[{minWidth: 150}]}
                key={other.account.did}
                label={_(
                  msg`Switch to ${sanitizeHandle(
                    other.profile?.handle ?? other.account.handle,
                    '@',
                  )}`,
                )}
                onPress={() =>
                  onPressSwitchAccount(other.account, 'SwitchAccount')
                }>
                <View style={[{marginLeft: tokens.space._2xs * -1}]}>
                  <UserAvatar
                    avatar={other.profile?.avatar}
                    size={20}
                    type={
                      other.profile?.associated?.labeler ? 'labeler' : 'user'
                    }
                  />
                </View>
                <Menu.ItemText>
                  {sanitizeHandle(
                    other.profile?.handle ?? other.account.handle,
                    '@',
                  )}
                </Menu.ItemText>
              </Menu.Item>
            ))}
          </Menu.Group>
          <Menu.Divider />
        </>
      )}
      <Menu.Item
        label={_(msg`Add another account`)}
        onPress={onAddAnotherAccount}>
        <Menu.ItemIcon icon={PlusIcon} />
        <Menu.ItemText>
          <Trans>Add another account</Trans>
        </Menu.ItemText>
      </Menu.Item>
      <Menu.Item label={_(msg`Sign out`)} onPress={signOutPromptControl.open}>
        <Menu.ItemIcon icon={LeaveIcon} />
        <Menu.ItemText>
          <Trans>Sign out</Trans>
        </Menu.ItemText>
      </Menu.Item>
    </Menu.Outer>
  )
}

export default SwitchMenuItems
