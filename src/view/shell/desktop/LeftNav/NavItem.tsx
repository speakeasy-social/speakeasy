import React from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useLinkProps, useNavigationState} from '@react-navigation/native'

import {useIntention} from '#/lib/hooks/useIntention'
import {getCurrentRoute, isTab} from '#/lib/routes/helpers'
import {CommonNavigatorParams} from '#/lib/routes/types'
import {emitSoftReset} from '#/state/events'
import {useSession} from '#/state/session'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {router} from '../../../../routes'

interface NavItemProps {
  count?: string
  hasNew?: boolean
  href: string
  icon: JSX.Element
  iconFilled: JSX.Element
  label: string
  onPress?: () => void
}

function NavItem({
  count,
  hasNew,
  href,
  icon,
  iconFilled,
  label,
  onPress,
}: NavItemProps) {
  const t = useTheme()
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {gtMobile, gtTablet} = useBreakpoints()
  const {setIntention} = useIntention()
  const isTablet = gtMobile && !gtTablet
  const [pathName] = React.useMemo(() => router.matchPath(href), [href])
  const currentRouteInfo = useNavigationState(state => {
    if (!state) {
      return {name: 'Intent'}
    }
    return getCurrentRoute(state)
  })
  let isCurrent =
    currentRouteInfo.name === 'Profile'
      ? isTab(currentRouteInfo.name, pathName) &&
        (currentRouteInfo.params as CommonNavigatorParams['Profile']).name ===
          currentAccount?.handle
      : isTab(currentRouteInfo.name, pathName)
  const {onPress: linkOnPress} = useLinkProps({to: href})
  const onPressWrapped = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      e.preventDefault()
      if (onPress) {
        onPress()
      } else if (isCurrent) {
        emitSoftReset()
      } else {
        // Set intention based on route
        if (['Profile', 'Notifications', 'Settings'].includes(pathName)) {
          setIntention(pathName)
        }
        linkOnPress()
      }
    },
    [linkOnPress, isCurrent, onPress, pathName, setIntention],
  )

  return (
    <PressableWithHover
      style={[
        a.flex_row,
        a.align_center,
        a.p_md,
        a.rounded_sm,
        a.gap_sm,
        a.outline_inset_1,
        a.transition_color,
      ]}
      hoverStyle={t.atoms.bg_contrast_25}
      // @ts-ignore the function signature differs on web -prf
      onPress={onPressWrapped}
      // @ts-ignore web only -prf
      href={href}
      dataSet={{noUnderline: 1}}
      role="link"
      accessibilityLabel={label}
      accessibilityHint="">
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.z_10,
          {
            width: 24,
            height: 24,
          },
          isTablet && {
            width: 40,
            height: 40,
          },
        ]}>
        {isCurrent ? iconFilled : icon}
        {typeof count === 'string' && count ? (
          <View
            style={[
              a.absolute,
              a.inset_0,
              {right: -20}, // more breathing room
            ]}>
            <Text
              accessibilityLabel={_(msg`${count} unread items`)}
              accessibilityHint=""
              accessible={true}
              numberOfLines={1}
              style={[
                a.absolute,
                a.text_xs,
                a.font_bold,
                a.rounded_full,
                a.text_center,
                a.leading_tight,
                {
                  top: '-10%',
                  left: count.length === 1 ? 12 : 8,
                  backgroundColor: t.palette.primary_500,
                  color: t.palette.white,
                  lineHeight: a.text_sm.fontSize,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  minWidth: 16,
                },
                isTablet && [
                  {
                    top: '10%',
                    left: count.length === 1 ? 20 : 16,
                  },
                ],
              ]}>
              {count}
            </Text>
          </View>
        ) : hasNew ? (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              {
                backgroundColor: t.palette.primary_500,
                width: 8,
                height: 8,
                right: -1,
                top: -3,
              },
              isTablet && {
                right: 6,
                top: 4,
              },
            ]}
          />
        ) : null}
      </View>
      {gtTablet && (
        <Text style={[a.text_xl, isCurrent ? a.font_heavy : a.font_normal]}>
          {label}
        </Text>
      )}
    </PressableWithHover>
  )
}

export default NavItem
