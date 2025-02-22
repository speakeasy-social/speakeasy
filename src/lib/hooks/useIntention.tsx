import React, {createContext, ReactNode, useContext, useState} from 'react'

// Define the shape of the context state
interface IntentionContextType {
  intention: string
  setIntention: (intention: string) => void
}

interface IntentionFeatures {
  [key: string]: string[]
}

const intentionFeatures: IntentionFeatures = {
  Feed: ['Feed', 'VideoFeed', 'Lists'],
  VideoFeed: ['VideoFeed'],
  Search: ['Search'],
  Groups: ['Groups', 'Mutual Aid'],
  Notifications: ['Notifications'],
  Messages: ['Messages'],
  Profile: ['Profiile'],
  'Mutual Aid': ['Mutual Aid'],
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
}

export const IntentionFilter: React.FC<IntentionFilterProps> = ({
  children,
  routeName,
}) => {
  const {intention} = useIntention()

  const showRoute =
    intention === 'Everything' ||
    intentionFeatures[intention]?.includes(routeName)

  console.log('showRoute', showRoute, intention, routeName)

  return <>{showRoute && children}</>
}
