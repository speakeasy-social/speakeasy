import React, {createContext, ReactNode, useContext, useState} from 'react'
import {useNavigationState} from '@react-navigation/native'

import {getCurrentRoute} from '#/lib/routes/helpers'

// Define the shape of the context state
interface IntentionContextType {
  intention: string
  setIntention: (intention: string) => void
}

interface IntentionFeatures {
  [key: string]: string[]
}

const intentionFeatures: IntentionFeatures = {
  Feed: ['Feed', 'VideoFeed', 'Lists', 'Compose'],
  VideoFeed: ['VideoFeed'],
  Search: ['Search'],
  Groups: ['Groups', 'Mutual Aid'],
  Notifications: ['Notifications'],
  Messages: ['Messages'],
  Profile: ['Profile'],
  'Mutual Aid': ['Mutual Aid'],
  Settings: ['Settings'],
  Intent: ['Notifications', 'Settings', 'Profile', 'Compose'],
}

// Create the context with default values
const IntentionContext = createContext<IntentionContextType | undefined>(
  undefined,
)

// Provider component
export const IntentionProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [intention, setIntention] = useState<string>('Everything')

  return (
    <IntentionContext.Provider value={{intention, setIntention}}>
      {children}
    </IntentionContext.Provider>
  )
}

// Custom hook to use the IntentionContext
export const useIntention = (): IntentionContextType => {
  const context = useContext(IntentionContext)
  if (!context) {
    throw new Error('useIntention must be used within an IntentionProvider')
  }
  return context
}

// IntentionFilter component
interface IntentionFilterProps {
  children: ReactNode
  routeName: string
  hideOnEverything?: boolean
}

export const IntentionFilter: React.FC<IntentionFilterProps> = ({
  children,
  routeName,
  hideOnEverything,
}) => {
  const currentRouteInfo = useNavigationState(state => {
    if (!state) {
      return {name: 'Intent'}
    }
    return getCurrentRoute(state)
  })

  const isIntentScreen = currentRouteInfo.name === 'Intent'

  const {intention} = useIntention()

  if (intention === 'Everything' && hideOnEverything) {
    return null
  }

  let selectedView = isIntentScreen ? 'Intent' : intention
  const showRoute =
    (intention === 'Everything' && !isIntentScreen) ||
    intentionFeatures[selectedView]?.includes(routeName)

  return <>{showRoute && children}</>
}
