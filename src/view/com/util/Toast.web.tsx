/*
 * Note: the dataSet properties are used to leverage custom CSS in public/index.html
 */

import React, {useEffect, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'
import {
  FontAwesomeIcon,
  FontAwesomeIconStyle,
  Props as FontAwesomeProps,
} from '@fortawesome/react-native-fontawesome'

const TIMEOUT = 2000
const LINKED_TIMEOUT = 20000

interface ActiveToast {
  text: string
  icon: FontAwesomeProps['icon']
  linkTitle?: string
  onLinkPress?: () => void
}

type GlobalSetActiveToast = (_activeToast: ActiveToast | undefined) => void

// globals
// =
let globalSetActiveToast: GlobalSetActiveToast | undefined
let toastTimeout: NodeJS.Timeout | undefined

// components
// =
type ToastContainerProps = {}
export const ToastContainer: React.FC<ToastContainerProps> = ({}) => {
  const [activeToast, setActiveToast] = useState<ActiveToast | undefined>()
  useEffect(() => {
    globalSetActiveToast = (t: ActiveToast | undefined) => {
      setActiveToast(t)
    }
  })
  return (
    <>
      {activeToast && (
        <View style={styles.container}>
          <FontAwesomeIcon
            icon={activeToast.icon}
            size={20}
            style={styles.icon as FontAwesomeIconStyle}
          />
          <View style={styles.content}>
            <Text style={styles.text}>{activeToast.text}</Text>
            {activeToast.linkTitle && (
              <Text
                style={styles.link}
                onPress={() => {
                  activeToast.onLinkPress?.()
                  setActiveToast(undefined)
                }}>
                {activeToast.linkTitle}
              </Text>
            )}
          </View>
          <Pressable
            style={styles.dismissBackdrop}
            accessibilityLabel="Dismiss"
            accessibilityHint=""
            onPress={() => {
              setActiveToast(undefined)
            }}
          />
        </View>
      )}
    </>
  )
}

// methods
// =

export function show(
  text: string,
  icon: FontAwesomeProps['icon'] = 'check',
  options?: Omit<ActiveToast, 'text' | 'icon'>,
) {
  if (toastTimeout) {
    clearTimeout(toastTimeout)
  }
  globalSetActiveToast?.({text, icon, ...options})
  toastTimeout = setTimeout(
    () => {
      globalSetActiveToast?.(undefined)
    },
    options?.onLinkPress ? LINKED_TIMEOUT : TIMEOUT,
  )
}

const styles = StyleSheet.create({
  container: {
    // @ts-ignore web only
    position: 'fixed',
    left: 20,
    bottom: 20,
    // @ts-ignore web only
    width: 'calc(100% - 40px)',
    maxWidth: 350,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000c',
    borderRadius: 10,
  },
  content: {
    flex: 1,
    marginLeft: 10,
  },
  dismissBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  icon: {
    color: '#fff',
    flexShrink: 0,
  },
  text: {
    color: '#fff',
    fontSize: 18,
  },
  link: {
    color: '#4dabf7',
    fontSize: 18,
    marginTop: 4,
  },
})
