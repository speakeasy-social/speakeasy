import React from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {IntentionFilter} from '#/lib/hooks/useIntention'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {CommonNavigatorParams} from '#/lib/routes/types'
import {isInvalidHandle} from '#/lib/strings/handles'
import {useFetchHandle} from '#/state/queries/handle'
import {useSession} from '#/state/session'
import {useComposerControls} from '#/state/shell/composer'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {EditBig_Stroke2_Corner0_Rounded as EditBig} from '#/components/icons/EditBig'

function ComposeBtn() {
  const {currentAccount} = useSession()
  const {getState} = useNavigation()
  const {openComposer} = useComposerControls()
  const {_} = useLingui()
  const {isTablet} = useWebMediaQueries()
  const [isFetchingHandle, setIsFetchingHandle] = React.useState(false)
  const fetchHandle = useFetchHandle()

  const getProfileHandle = async () => {
    const routes = getState()?.routes
    const currentRoute = routes?.[routes?.length - 1]

    if (currentRoute?.name === 'Profile') {
      let handle: string | undefined = (
        currentRoute.params as CommonNavigatorParams['Profile']
      ).name

      if (handle.startsWith('did:')) {
        try {
          setIsFetchingHandle(true)
          handle = await fetchHandle(handle)
        } catch (e) {
          handle = undefined
        } finally {
          setIsFetchingHandle(false)
        }
      }

      if (
        !handle ||
        handle === currentAccount?.handle ||
        isInvalidHandle(handle)
      )
        return undefined

      return handle
    }

    return undefined
  }

  const onPressCompose = async () =>
    openComposer({mention: await getProfileHandle()})

  if (isTablet) {
    return null
  }
  return (
    <IntentionFilter routeName="Compose">
      <View style={[a.flex_row, a.pl_md, a.pt_xl]}>
        <Button
          disabled={isFetchingHandle}
          label={_(msg`Compose new post`)}
          onPress={onPressCompose}
          size="large"
          variant="solid"
          color="primary"
          style={[a.rounded_full]}>
          <ButtonIcon icon={EditBig} position="left" />
          <ButtonText>
            <Trans context="action">New Post</Trans>
          </ButtonText>
        </Button>
      </View>
    </IntentionFilter>
  )
}

export default ComposeBtn
